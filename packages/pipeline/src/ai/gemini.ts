import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { GeminiScreenResult, RawArticle } from "@journal-watch/shared";
import { loadActivePrompt } from "../lib/prompts.js";

const criteriaEnum = z.enum([
  "interest",
  "influential",
  "groupRelevant",
  "reusableMethods",
  "dubious",
]);

const resultSchema = z.object({
  relevanceScore: z.number().min(0).max(1),
  criteriaMatched: z.array(criteriaEnum),
  summaryZh: z.string(),
  reason: z.string(),
});

const batchItemSchema = resultSchema.extend({
  id: z.string().min(1),
});

const batchSchema = z.object({
  results: z.array(batchItemSchema),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  const startObj = body.indexOf("{");
  const startArr = body.indexOf("[");
  if (startArr >= 0 && (startObj < 0 || startArr < startObj)) {
    const endArr = body.lastIndexOf("]");
    if (endArr > startArr) return JSON.parse(body.slice(startArr, endArr + 1));
  }
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(body.slice(start, end + 1));
  }
  return JSON.parse(body);
}

function requireApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is required for screening. Set it in .env or CI secrets.",
    );
  }
  return apiKey;
}

function buildTitleBatchPayload(articles: RawArticle[]): string {
  const lines = articles.map((a, i) => {
    return `${i + 1}. id=${a.id}
   Title: ${a.title}
   JournalId: ${a.journalId}
   Published: ${a.publishedAt ?? "unknown"}
   DOI: ${a.doi ?? "n/a"}`;
  });
  return `Papers to score (title only). Return JSON with a "results" array covering every id:

${lines.join("\n\n")}
`;
}

function buildDetailPayload(article: RawArticle): string {
  return `Paper:
Title: ${article.title}
JournalId: ${article.journalId}
Published: ${article.publishedAt ?? "unknown"}
URL: ${article.url}
DOI: ${article.doi ?? "n/a"}
Abstract: ${article.abstract ?? "(none provided — judge carefully from title)"}
`;
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = `${err.message} ${err.cause ?? ""}`.toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("connect timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("socket") ||
    msg.includes("und_err")
  );
}

function networkHint(err: unknown): Error {
  const cause =
    err instanceof Error && err.cause instanceof Error
      ? err.cause.message
      : err instanceof Error
        ? err.message
        : String(err);
  return new Error(
    `Cannot reach Gemini API (generativelanguage.googleapis.com). ${cause}\n` +
      `  → 检查网络是否能访问 Google Gemini API，以及 .env 里 GEMINI_API_KEY 是否有效`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getModel() {
  const apiKey = requireApiKey();
  const modelName = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  });
}

async function generateWithRetry(fullPrompt: string, label: string): Promise<string> {
  const model = getModel();
  const retries = Math.max(1, Number(process.env.GEMINI_RETRIES ?? 3));
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(fullPrompt);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err) || attempt === retries) break;
      const wait = 800 * attempt;
      console.warn(`[gemini] network retry ${attempt}/${retries} for ${label} in ${wait}ms`);
      await sleep(wait);
    }
  }
  if (isNetworkError(lastErr)) throw networkHint(lastErr);
  throw lastErr;
}

function parseBatchResults(text: string, expectedIds: string[]): Map<string, GeminiScreenResult> {
  const raw = extractJson(text);
  let items: z.infer<typeof batchItemSchema>[] = [];

  if (Array.isArray(raw)) {
    items = z.array(batchItemSchema).parse(raw);
  } else if (raw && typeof raw === "object" && "results" in raw) {
    items = batchSchema.parse(raw).results;
  } else if (raw && typeof raw === "object" && "id" in raw) {
    items = [batchItemSchema.parse(raw)];
  } else if (raw && typeof raw === "object" && expectedIds.length === 1) {
    // Single-object legacy shape without id
    const one = resultSchema.parse(raw);
    items = [{ id: expectedIds[0], ...one }];
  } else {
    throw new Error("Unexpected Gemini batch JSON shape (expected { results: [...] })");
  }

  const map = new Map<string, GeminiScreenResult>();
  for (const item of items) {
    map.set(item.id, {
      relevanceScore: item.relevanceScore,
      criteriaMatched: item.criteriaMatched,
      summaryZh: item.summaryZh,
      reason: item.reason,
    });
  }
  return map;
}

/**
 * Papers per title-screen API call (TITLE_BATCH_SIZE).
 * Titles are tiny vs Gemini context; quota is mostly RPD (requests/day), not tokens.
 * Default 80: ~6 calls for ~500 papers. 100–150 is fine; 400+ in one call risks
 * truncated/missing JSON ids even though context window allows it.
 */
export function getTitleBatchSize(): number {
  const n = Number(process.env.TITLE_BATCH_SIZE ?? "80");
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 80;
}

/**
 * Stage 1: batch title-only screen.
 * One Gemini request scores many titles → saves free-tier RPD.
 */
export async function screenTitleBatch(
  articles: RawArticle[],
): Promise<{ results: Map<string, GeminiScreenResult>; promptId: string }> {
  if (articles.length === 0) {
    return { results: new Map(), promptId: "" };
  }

  const prompt = loadActivePrompt("titleScreen");
  const expectedIds = articles.map((a) => a.id);
  const fullPrompt = `${prompt.body}

---

${buildTitleBatchPayload(articles)}
`;

  const text = await generateWithRetry(fullPrompt, `title-batch×${articles.length}`);
  const parsed = parseBatchResults(text, expectedIds);

  const missing = expectedIds.filter((id) => !parsed.has(id));
  if (missing.length > 0) {
    // Smaller follow-up batch for any ids the model dropped
    console.warn(
      `[gemini] title batch missing ${missing.length}/${articles.length} ids — retrying remainder`,
    );
    const remainder = articles.filter((a) => missing.includes(a.id));
    if (remainder.length === articles.length) {
      throw new Error(
        `Gemini title batch returned no matching ids (got ${parsed.size}, expected ${articles.length})`,
      );
    }
    const again = await screenTitleBatch(remainder);
    for (const [id, result] of again.results) parsed.set(id, result);
  }

  return { results: parsed, promptId: prompt.id };
}

/** Stage 1 single-article helper (uses batch of 1). */
export async function screenTitle(
  article: RawArticle,
): Promise<{ result: GeminiScreenResult; promptId: string }> {
  const { results, promptId } = await screenTitleBatch([article]);
  const result = results.get(article.id);
  if (!result) throw new Error(`No title-screen result for ${article.id}`);
  return { result, promptId };
}

/** Stage 2: detail screen (one paper per call — abstracts are longer). */
export async function screenDetail(
  article: RawArticle,
): Promise<{ result: GeminiScreenResult; promptId: string }> {
  const prompt = loadActivePrompt("detailScreen");
  const fullPrompt = `${prompt.body}

---

${buildDetailPayload(article)}
`;
  const text = await generateWithRetry(fullPrompt, article.id);
  const parsed = resultSchema.parse(extractJson(text));
  return { result: parsed, promptId: prompt.id };
}

/** @deprecated use screenTitle / screenDetail */
export async function screenArticle(article: RawArticle): Promise<GeminiScreenResult> {
  const { result } = await screenDetail(article);
  return result;
}

export function getRelevanceThreshold(): number {
  const n = Number(process.env.RELEVANCE_THRESHOLD ?? "0.45");
  return Number.isFinite(n) ? n : 0.45;
}

/** Title-pass auto-keep threshold (pending + score >= this → eligible for detail). */
export function getTitleKeepThreshold(): number {
  const n = Number(process.env.TITLE_KEEP_THRESHOLD ?? process.env.RELEVANCE_THRESHOLD ?? "0.45");
  return Number.isFinite(n) ? n : 0.45;
}

import type { CandidateArticle, CandidatesFile, RawArticle } from "@journal-watch/shared";
import {
  getGeminiDelayMs,
  getTitleBatchSize,
  getTitleKeepThreshold,
  screenTitleBatch,
} from "./ai/gemini.js";
import {
  ensureDataDirs,
  loadCandidates,
  loadLatestRawArticles,
  saveCandidates,
} from "./lib/paths.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function effectiveScore(c: CandidateArticle): number {
  return c.humanScore ?? c.aiScore;
}

/**
 * Stage 1: title-only AI screen → data/candidates.json
 * Preserves human decision / humanScore / note on merge.
 * New articles are scored in batches (TITLE_BATCH_SIZE, default 80) to save API RPD.
 */
export async function runScreenTitle(): Promise<{
  considered: number;
  written: number;
  threshold: number;
  promptId: string;
  batches: number;
}> {
  ensureDataDirs();
  const threshold = getTitleKeepThreshold();
  const batchSize = getTitleBatchSize();
  const raw = loadLatestRawArticles();
  const existing = loadCandidates();
  const prevById = new Map(existing.candidates.map((c) => [c.articleId, c]));

  const nextById = new Map<string, CandidateArticle>();
  const toScreen: RawArticle[] = [];
  let promptId = existing.titlePromptId || "";

  for (const article of raw) {
    const prev = prevById.get(article.id);
    // Skip by stable id (doi:… when DOI exists; else hash:…). Ignore fetchedAt.
    if (prev) {
      nextById.set(prev.articleId, {
        ...prev,
        journalId: article.journalId,
        title: article.title,
        url: article.url,
        doi: article.doi,
        publishedAt: article.publishedAt,
        abstract: article.abstract,
        fetchedAt: article.fetchedAt,
        source: article.source,
      });
      continue;
    }
    toScreen.push(article);
  }

  let batches = 0;
  for (let i = 0; i < toScreen.length; i += batchSize) {
    const chunk = toScreen.slice(i, i + batchSize);
    batches += 1;
    console.log(
      `[title] batch ${batches} (${chunk.length} papers, ${i + 1}–${i + chunk.length}/${toScreen.length})`,
    );

    const { results, promptId: pid } = await screenTitleBatch(chunk);
    promptId = pid;
    const now = new Date().toISOString();

    for (const article of chunk) {
      const result = results.get(article.id);
      if (!result) {
        throw new Error(`Missing title-screen result for ${article.id}`);
      }
      console.log(
        `  ${article.journalId} | ${article.title.slice(0, 50)}... score=${result.relevanceScore.toFixed(2)}`,
      );
      nextById.set(article.id, {
        articleId: article.id,
        journalId: article.journalId,
        title: article.title,
        url: article.url,
        doi: article.doi,
        publishedAt: article.publishedAt,
        abstract: article.abstract,
        fetchedAt: article.fetchedAt,
        source: article.source,
        aiScore: result.relevanceScore,
        criteriaMatched: result.criteriaMatched,
        reason: result.reason,
        summaryZh: result.summaryZh,
        titlePromptId: pid,
        screenedAt: now,
        decision: "pending",
        updatedAt: now,
      });
    }

    if (i + batchSize < toScreen.length) {
      await sleep(getGeminiDelayMs());
    }
  }

  for (const prev of existing.candidates) {
    if (!nextById.has(prev.articleId)) {
      nextById.set(prev.articleId, prev);
    }
  }

  const candidates = [...nextById.values()].sort(
    (a, b) => effectiveScore(b) - effectiveScore(a),
  );

  const file: CandidatesFile = {
    updatedAt: new Date().toISOString(),
    titlePromptId: promptId,
    threshold,
    candidates,
  };
  saveCandidates(file);

  return {
    considered: toScreen.length,
    written: candidates.length,
    threshold,
    promptId,
    batches,
  };
}

/** Candidates eligible for detail pass. */
export function selectForDetail(file: CandidatesFile): CandidateArticle[] {
  return file.candidates.filter((c) => {
    if (c.decision === "drop") return false;
    if (c.decision === "keep") return true;
    return effectiveScore(c) >= file.threshold;
  });
}

export function rawFromCandidate(c: CandidateArticle): RawArticle {
  return {
    id: c.articleId,
    journalId: c.journalId,
    title: c.title,
    abstract: c.abstract,
    publishedAt: c.publishedAt,
    url: c.url,
    doi: c.doi,
    fetchedAt: c.fetchedAt,
    source: c.source,
  };
}

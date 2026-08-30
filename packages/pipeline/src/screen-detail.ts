import type { ScreenedArticle } from "@journal-watch/shared";
import { getGeminiDelayMs, screenDetail } from "./ai/gemini.js";
import { rawFromCandidate, selectForDetail } from "./screen-title.js";
import {
  ensureDataDirs,
  loadCandidates,
  loadCleanDb,
  loadMeta,
  saveCleanDb,
  saveMeta,
} from "./lib/paths.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function persistDetail(
  keptById: Map<string, ScreenedArticle>,
  meta: ReturnType<typeof loadMeta>,
): void {
  const articles = [...keptById.values()].sort((a, b) => {
    const da = a.publishedAt ?? a.fetchedAt;
    const db = b.publishedAt ?? b.fetchedAt;
    return db.localeCompare(da);
  });

  saveCleanDb({
    updatedAt: new Date().toISOString(),
    articles,
  });

  const counts: Record<string, number> = {};
  for (const a of articles) {
    counts[a.journalId] = (counts[a.journalId] ?? 0) + 1;
  }
  for (const [journalId, keptCount] of Object.entries(counts)) {
    meta.journals[journalId] = {
      lastCrawlAt: meta.journals[journalId]?.lastCrawlAt ?? meta.lastCrawlAt,
      rawCount: meta.journals[journalId]?.rawCount ?? 0,
      keptCount,
      error: meta.journals[journalId]?.error,
    };
  }
  saveMeta(meta);
}

/**
 * After screen:title + human keep/drop: enrich shortlist → data/clean/articles.json
 * CLI: pnpm fetch:detail
 */
export async function runScreenDetail(): Promise<{
  considered: number;
  kept: number;
  promptId: string;
}> {
  ensureDataDirs();
  const candidatesFile = loadCandidates();
  const shortlist = selectForDetail(candidatesFile);
  if (shortlist.length === 0) {
    console.log("[fetch:detail] no candidates eligible (set decision=keep or raise AI score)");
    return { considered: 0, kept: 0, promptId: "" };
  }

  const existing = loadCleanDb();
  const keptById = new Map(existing.articles.map((a) => [a.id, a]));
  const meta = loadMeta();

  let considered = 0;
  let newlyKept = 0;
  let promptId = "";

  for (const cand of shortlist) {
    const prev = keptById.get(cand.articleId);
    // Skip by stable id (doi:… / hash:…). Ignore fetchedAt.
    if (prev) {
      keptById.set(prev.id, {
        ...prev,
        journalId: cand.journalId,
        title: cand.title,
        url: cand.url,
        doi: cand.doi,
        publishedAt: cand.publishedAt,
        abstract: cand.abstract,
        fetchedAt: cand.fetchedAt,
        source: cand.source,
      });
      continue;
    }

    considered += 1;
    const article = rawFromCandidate(cand);
    process.stdout.write(`[fetch:detail] ${article.journalId} | ${article.title.slice(0, 60)}... `);
    const { result, promptId: pid } = await screenDetail(article);
    promptId = pid;
    console.log(`score=${result.relevanceScore.toFixed(2)}`);

    const screened: ScreenedArticle = {
      ...article,
      relevanceScore: result.relevanceScore,
      criteriaMatched: result.criteriaMatched,
      summaryZh: result.summaryZh,
      reason: result.reason,
      screenedAt: new Date().toISOString(),
    };
    keptById.set(screened.id, screened);
    newlyKept += 1;
    persistDetail(keptById, meta);

    await sleep(getGeminiDelayMs());
  }

  persistDetail(keptById, meta);

  return { considered, kept: newlyKept, promptId };
}

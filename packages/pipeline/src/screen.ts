import type { ScreenedArticle } from "@journal-watch/shared";
import { getRelevanceThreshold, screenArticle } from "./ai/gemini.js";
import {
  ensureDataDirs,
  loadCleanDb,
  loadLatestRawArticles,
  loadMeta,
  saveCleanDb,
  saveMeta,
} from "./lib/paths.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @deprecated Prefer screen:title → human review → fetch:detail.
 */
export async function runScreen(): Promise<{
  considered: number;
  kept: number;
  threshold: number;
}> {
  console.warn(
    "[screen] legacy one-shot; prefer: pnpm screen:title → review → pnpm fetch:detail",
  );
  ensureDataDirs();
  const threshold = getRelevanceThreshold();
  const raw = loadLatestRawArticles();
  const existing = loadCleanDb();
  const existingById = new Map(existing.articles.map((a) => [a.id, a]));

  const keptById = new Map<string, ScreenedArticle>();
  for (const a of existing.articles) {
    keptById.set(a.id, a);
  }

  const meta = loadMeta();
  let considered = 0;
  let newlyKept = 0;

  for (const article of raw) {
    const prev = existingById.get(article.id);
    if (prev) {
      keptById.set(prev.id, {
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

    considered += 1;
    process.stdout.write(`[screen] ${article.journalId} | ${article.title.slice(0, 60)}... `);
    const result = await screenArticle(article);
    console.log(`score=${result.relevanceScore.toFixed(2)}`);

    if (result.relevanceScore >= threshold) {
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
    }

    await sleep(Number(process.env.GEMINI_DELAY_MS ?? 400));
  }

  const articles = [...keptById.values()].sort((a, b) => {
    const da = a.publishedAt ?? a.fetchedAt;
    const db = b.publishedAt ?? b.fetchedAt;
    return db.localeCompare(da);
  });

  saveCleanDb({ updatedAt: new Date().toISOString(), articles });

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

  return { considered, kept: newlyKept, threshold };
}

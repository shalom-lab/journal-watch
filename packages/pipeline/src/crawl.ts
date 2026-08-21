import type { CrawlMeta, RawArticle } from "@journal-watch/shared";
import { fetchJournal } from "./adapters/index.js";
import {
  loadEnabledJournals,
  loadMeta,
  saveMeta,
  writeRawBatch,
  ensureDataDirs,
} from "./lib/paths.js";

function dedupe(articles: RawArticle[]): RawArticle[] {
  const map = new Map<string, RawArticle>();
  for (const a of articles) {
    map.set(a.id, a);
  }
  return [...map.values()];
}

export async function runCrawl(): Promise<{
  totalRaw: number;
  byJournal: Record<string, number>;
}> {
  ensureDataDirs();
  const journals = loadEnabledJournals();
  if (journals.length === 0) {
    throw new Error("No enabled journals in config/journals.yaml");
  }

  const meta: CrawlMeta = loadMeta();
  const now = new Date().toISOString();
  const byJournal: Record<string, number> = {};
  let totalRaw = 0;

  for (const journal of journals) {
    process.stdout.write(`[crawl] ${journal.id} via ${journal.adapter} ... `);
    try {
      const articles = dedupe(await fetchJournal(journal));
      writeRawBatch(journal.id, articles);
      byJournal[journal.id] = articles.length;
      totalRaw += articles.length;
      meta.journals[journal.id] = {
        lastCrawlAt: now,
        rawCount: articles.length,
        keptCount: meta.journals[journal.id]?.keptCount ?? 0,
      };
      console.log(`${articles.length} articles`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${message}`);
      meta.journals[journal.id] = {
        lastCrawlAt: now,
        rawCount: 0,
        keptCount: meta.journals[journal.id]?.keptCount ?? 0,
        error: message,
      };
      byJournal[journal.id] = 0;
    }
  }

  meta.lastCrawlAt = now;
  saveMeta(meta);
  return { totalRaw, byJournal };
}

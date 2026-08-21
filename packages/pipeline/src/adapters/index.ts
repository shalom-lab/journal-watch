import type { Adapter, AdapterKind, JournalConfig, RawArticle } from "@journal-watch/shared";
import { rssAdapter } from "../adapters/rss.js";
import { crossrefAdapter } from "../adapters/crossref.js";
import { playwrightAdapter } from "../adapters/playwright.js";

const registry: Record<AdapterKind, Adapter> = {
  rss: rssAdapter,
  crossref: crossrefAdapter,
  playwright: playwrightAdapter,
};

export function getAdapter(kind: AdapterKind): Adapter {
  const adapter = registry[kind];
  if (!adapter) {
    throw new Error(`Unknown adapter: ${kind}`);
  }
  return adapter;
}

export async function fetchJournal(journal: JournalConfig): Promise<RawArticle[]> {
  const adapter = getAdapter(journal.adapter);
  try {
    return await adapter.fetchLatest(journal);
  } catch (err) {
    // Cloudflare / flaky RSS: fall back to Crossref when ISSN is available
    if (journal.adapter === "rss" && journal.issn) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[adapter] ${journal.id} rss failed (${message}); falling back to crossref`);
      return crossrefAdapter.fetchLatest({ ...journal, adapter: "crossref" });
    }
    throw err;
  }
}

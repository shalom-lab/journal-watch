import type { Adapter, JournalConfig, RawArticle } from "@journal-watch/shared";
import { makeRawArticle, normalizeDoi } from "../lib/ids.js";

interface CrossrefWork {
  DOI?: string;
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  abstract?: string;
  URL?: string;
  published?: { "date-parts"?: number[][] };
  created?: { "date-parts"?: number[][] };
  type?: string;
}

interface CrossrefResponse {
  message?: {
    items?: CrossrefWork[];
  };
}

function formatDate(parts?: number[][]): string | undefined {
  if (!parts?.[0]?.length) return undefined;
  const [y, m = 1, d = 1] = parts[0];
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function stripJats(abstract?: string): string | undefined {
  if (!abstract) return undefined;
  return abstract
    .replace(/<\/?jats:[^>]+>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Crawl = latest articles only (by ISSN + date), no keyword search.
 * Topic filtering belongs to the AI screen step.
 */
export const crossrefAdapter: Adapter = {
  kind: "crossref",

  async fetchLatest(journal: JournalConfig): Promise<RawArticle[]> {
    if (!journal.issn) {
      throw new Error(`Journal ${journal.id} uses crossref adapter but has no issn`);
    }

    const mailto = process.env.CROSSREF_MAILTO || "journal-watch@users.noreply.github.com";
    // Default high enough to cover recent issues; override with CROSSREF_ROWS
    const rows = Number(process.env.CROSSREF_ROWS || 100);
    const from = new Date();
    from.setMonth(from.getMonth() - 3);
    const fromDate = from.toISOString().slice(0, 10);

    const params = new URLSearchParams({
      filter: [
        `issn:${journal.issn}`,
        "type:journal-article",
        `from-pub-date:${fromDate}`,
      ].join(","),
      rows: String(rows),
      sort: "published",
      order: "desc",
      select: "DOI,title,author,abstract,URL,published,created,type",
      mailto,
    });

    const res = await fetch(`https://api.crossref.org/works?${params.toString()}`, {
      headers: {
        "User-Agent": `journal-watch/0.1 (mailto:${mailto})`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Crossref fetch failed for ${journal.id}: HTTP ${res.status}`);
    }

    const json = (await res.json()) as CrossrefResponse;
    const items = json.message?.items ?? [];
    const fetchedAt = new Date().toISOString();

    return items
      .map((w) => {
        const title = w.title?.[0]?.trim();
        if (!title) return null;
        const doi = normalizeDoi(w.DOI);
        const articleUrl = w.URL || (doi ? `https://doi.org/${doi}` : "");
        if (!articleUrl) return null;
        const authors = (w.author ?? [])
          .map((a) => {
            if (a.name) return a.name;
            return [a.given, a.family].filter(Boolean).join(" ");
          })
          .filter(Boolean);

        return makeRawArticle({
          journalId: journal.id,
          title,
          url: articleUrl,
          source: "crossref",
          abstract: stripJats(w.abstract),
          authors: authors.length ? authors : undefined,
          publishedAt:
            formatDate(w.published?.["date-parts"]) || formatDate(w.created?.["date-parts"]),
          doi,
          fetchedAt,
        });
      })
      .filter((a): a is RawArticle => a != null);
  },
};

import { createHash } from "node:crypto";
import type { AdapterKind, RawArticle } from "@journal-watch/shared";

export function normalizeDoi(doi?: string | null): string | undefined {
  if (!doi) return undefined;
  const cleaned = doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  return cleaned || undefined;
}

export function articleIdFrom(parts: {
  doi?: string;
  url?: string;
  title?: string;
  journalId: string;
}): string {
  const doi = normalizeDoi(parts.doi);
  if (doi) return `doi:${doi.toLowerCase()}`;
  const key = parts.url || parts.title || "";
  const hash = createHash("sha1").update(`${parts.journalId}|${key}`).digest("hex").slice(0, 16);
  return `hash:${hash}`;
}

export function makeRawArticle(input: {
  journalId: string;
  title: string;
  url: string;
  source: AdapterKind;
  abstract?: string;
  authors?: string[];
  publishedAt?: string;
  doi?: string;
  fetchedAt?: string;
}): RawArticle {
  const doi = normalizeDoi(input.doi);
  return {
    id: articleIdFrom({
      doi,
      url: input.url,
      title: input.title,
      journalId: input.journalId,
    }),
    journalId: input.journalId,
    title: input.title.trim(),
    abstract: input.abstract?.trim() || undefined,
    authors: input.authors?.filter(Boolean),
    publishedAt: input.publishedAt,
    url: input.url,
    doi,
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    source: input.source,
  };
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

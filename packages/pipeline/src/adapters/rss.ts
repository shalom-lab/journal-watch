import { XMLParser } from "fast-xml-parser";
import type { Adapter, JournalConfig, RawArticle } from "@journal-watch/shared";
import { makeRawArticle, normalizeDoi, stripHtml } from "../lib/ids.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && node !== null && "#text" in node) {
    return String((node as { "#text": unknown })["#text"] ?? "");
  }
  return "";
}

function linkOf(item: Record<string, unknown>): string {
  const link = item.link;
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    const first = link[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      return String((first as { "@_href"?: string; "#text"?: string })["@_href"]
        ?? (first as { "#text"?: string })["#text"]
        ?? "");
    }
  }
  if (link && typeof link === "object") {
    const obj = link as { "@_href"?: string; "#text"?: string };
    return String(obj["@_href"] ?? obj["#text"] ?? "");
  }
  const guid = item.guid;
  if (typeof guid === "string") return guid;
  if (guid && typeof guid === "object") return textOf(guid);
  return "";
}

function doiFromItem(item: Record<string, unknown>, link: string): string | undefined {
  const candidates = [
    item["prism:doi"],
    item["dc:identifier"],
    item.doi,
    item["pubmed:doi"],
  ];
  for (const c of candidates) {
    const t = textOf(c);
    if (/10\.\d{4,}/.test(t)) return normalizeDoi(t.replace(/^doi:/i, ""));
  }
  const m = link.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  return m ? normalizeDoi(m[0]) : undefined;
}

function authorsOf(item: Record<string, unknown>): string[] | undefined {
  const creators = asArray(item["dc:creator"] ?? item.author ?? item["dc:Creator"]);
  const names = creators.map((c) => textOf(c)).filter(Boolean);
  return names.length ? names : undefined;
}

function publishedOf(item: Record<string, unknown>): string | undefined {
  const raw =
    textOf(item.pubDate) ||
    textOf(item.published) ||
    textOf(item["dc:date"]) ||
    textOf(item["prism:publicationDate"]);
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10);
}

function collectItems(doc: Record<string, unknown>): Record<string, unknown>[] {
  const channelItems = asArray(
    (doc?.rss as { channel?: { item?: unknown } } | undefined)?.channel?.item,
  );
  if (channelItems.length) return channelItems as Record<string, unknown>[];

  const atomEntries = asArray((doc?.feed as { entry?: unknown } | undefined)?.entry);
  if (atomEntries.length) return atomEntries as Record<string, unknown>[];

  // RSS 1.0 RDF
  const rdf = doc["rdf:RDF"] as { item?: unknown } | undefined;
  const rdfItems = asArray(rdf?.item ?? (doc as { item?: unknown }).item);
  return rdfItems as Record<string, unknown>[];
}

function linkOfRdf(item: Record<string, unknown>): string {
  const about = item["@_rdf:about"];
  if (typeof about === "string" && about) return about;
  return linkOf(item);
}

export const rssAdapter: Adapter = {
  kind: "rss",

  async fetchLatest(journal: JournalConfig): Promise<RawArticle[]> {
    if (!journal.feedUrl) {
      throw new Error(`Journal ${journal.id} uses rss adapter but has no feedUrl`);
    }

    const res = await fetch(journal.feedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`RSS fetch failed for ${journal.id}: HTTP ${res.status}`);
    }

    const xml = await res.text();
    if (/just a moment|cf-browser-verification|attention required/i.test(xml)) {
      throw new Error(`RSS blocked by Cloudflare for ${journal.id}`);
    }

    const doc = parser.parse(xml) as Record<string, unknown>;
    const items = collectItems(doc);

    const fetchedAt = new Date().toISOString();
    const articles: RawArticle[] = [];

    for (const item of items) {
      const title = stripHtml(textOf(item.title));
      if (!title) continue;
      const url = linkOfRdf(item);
      if (!url) continue;
      const description = stripHtml(
        textOf(item.description) ||
          textOf(item.summary) ||
          textOf(item["content:encoded"]) ||
          textOf(item.content),
      );

      articles.push(
        makeRawArticle({
          journalId: journal.id,
          title,
          url,
          source: "rss",
          abstract: description || undefined,
          authors: authorsOf(item),
          publishedAt: publishedOf(item),
          doi: doiFromItem(item, url),
          fetchedAt,
        }),
      );
    }

    return articles;
  },
};

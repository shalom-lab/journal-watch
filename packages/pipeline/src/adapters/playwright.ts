import { chromium } from "playwright";
import type { Adapter, JournalConfig, RawArticle } from "@journal-watch/shared";
import { makeRawArticle } from "../lib/ids.js";

/**
 * Template Playwright adapter for journals without RSS/Crossref coverage.
 * Journals must set adapter: playwright and homepageUrl.
 * Selectors can later move into journals.yaml as extra attributes.
 *
 * Default strategy: collect links that look like article pages from the homepage.
 * This is intentionally conservative — extend per-journal when needed.
 */
export const playwrightAdapter: Adapter = {
  kind: "playwright",

  async fetchLatest(journal: JournalConfig): Promise<RawArticle[]> {
    if (!journal.homepageUrl) {
      throw new Error(`Journal ${journal.id} uses playwright adapter but has no homepageUrl`);
    }

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        userAgent:
          "Mozilla/5.0 (compatible; journal-watch/0.1; +https://github.com/journal-watch)",
      });
      await page.goto(journal.homepageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

      const links = await page.$$eval("a[href]", (anchors) =>
        anchors
          .map((a) => ({
            href: (a as HTMLAnchorElement).href,
            title: (a.textContent || "").replace(/\s+/g, " ").trim(),
          }))
          .filter((x) => x.title.length > 25 && /\/(doi|article|full|content)\//i.test(x.href)),
      );

      const seen = new Set<string>();
      const fetchedAt = new Date().toISOString();
      const articles: RawArticle[] = [];

      for (const link of links) {
        if (seen.has(link.href)) continue;
        seen.add(link.href);
        articles.push(
          makeRawArticle({
            journalId: journal.id,
            title: link.title,
            url: link.href,
            source: "playwright",
            fetchedAt,
          }),
        );
        if (articles.length >= 30) break;
      }

      return articles;
    } finally {
      await browser.close();
    }
  },
};

/** Adapter kinds supported by the crawl pipeline. */
export type AdapterKind = "rss" | "crossref" | "playwright";

/** Selection criteria aligned with the journal-watch SOP. */
export type CriteriaTag =
  | "interest"
  | "influential"
  | "groupRelevant"
  | "reusableMethods"
  | "dubious";

export interface JournalConfig {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  issn?: string;
  adapter: AdapterKind;
  feedUrl?: string;
  homepageUrl?: string;
  enabled: boolean;
  /** Non-academic types to prefer excluding (hint for AI). */
  excludeTypes?: string[];
}

export interface JournalsFile {
  journals: JournalConfig[];
}

/** Unified raw article shape — every adapter must return this. */
export interface RawArticle {
  id: string;
  journalId: string;
  title: string;
  abstract?: string;
  authors?: string[];
  publishedAt?: string;
  url: string;
  doi?: string;
  fetchedAt: string;
  source: AdapterKind;
}

/** AI-screened article kept in the clean database. */
export interface ScreenedArticle extends RawArticle {
  relevanceScore: number;
  criteriaMatched: CriteriaTag[];
  summaryZh: string;
  reason: string;
  screenedAt: string;
}

export interface ArticleRating {
  articleId: string;
  score: 1 | 2 | 3 | 4 | 5;
  note?: string;
  updatedAt: string;
}

export interface RatingsFile {
  updatedAt: string;
  ratings: ArticleRating[];
}

export interface JournalCrawlStats {
  lastCrawlAt: string;
  rawCount: number;
  keptCount: number;
  error?: string;
}

export interface CrawlMeta {
  lastCrawlAt: string;
  journals: Record<string, JournalCrawlStats>;
}

export interface CleanDatabase {
  updatedAt: string;
  articles: ScreenedArticle[];
}

export interface GeminiScreenResult {
  relevanceScore: number;
  criteriaMatched: CriteriaTag[];
  summaryZh: string;
  reason: string;
}

/** Human/AI decision on a title-screened candidate. */
export type CandidateDecision = "pending" | "keep" | "drop";

/** Title-screen candidate awaiting human review / detail pass. */
export interface CandidateArticle {
  articleId: string;
  journalId: string;
  title: string;
  url: string;
  doi?: string;
  publishedAt?: string;
  abstract?: string;
  fetchedAt: string;
  source: AdapterKind;
  /** AI title-screen score 0–1 */
  aiScore: number;
  criteriaMatched: CriteriaTag[];
  reason: string;
  summaryZh: string;
  titlePromptId: string;
  screenedAt: string;
  /** Optional human override score 0–1 */
  humanScore?: number;
  decision: CandidateDecision;
  note?: string;
  updatedAt: string;
}

export interface CandidatesFile {
  updatedAt: string;
  titlePromptId: string;
  threshold: number;
  candidates: CandidateArticle[];
}

export interface Adapter {
  kind: AdapterKind;
  fetchLatest(journal: JournalConfig): Promise<RawArticle[]>;
}

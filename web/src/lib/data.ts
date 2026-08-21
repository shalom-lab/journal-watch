import yaml from "js-yaml";
import type {
  CandidatesFile,
  CleanDatabase,
  CrawlMeta,
  JournalConfig,
  JournalsFile,
  RatingsFile,
} from "@journal-watch/shared";

const base = import.meta.env.BASE_URL;

function url(path: string): string {
  return `${base}${path.replace(/^\//, "")}`;
}

export async function fetchArticles(): Promise<CleanDatabase> {
  const res = await fetch(url("data/clean/articles.json"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load articles: ${res.status}`);
  return res.json();
}

export async function fetchCandidates(): Promise<CandidatesFile> {
  const res = await fetch(url("data/candidates.json"), { cache: "no-store" });
  if (!res.ok) {
    return {
      updatedAt: new Date(0).toISOString(),
      titlePromptId: "",
      threshold: 0.45,
      candidates: [],
    };
  }
  return res.json();
}

export async function fetchMeta(): Promise<CrawlMeta> {
  const res = await fetch(url("data/meta.json"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load meta: ${res.status}`);
  return res.json();
}

export async function fetchRatings(): Promise<RatingsFile> {
  const res = await fetch(url("data/ratings.json"), { cache: "no-store" });
  if (!res.ok) {
    return { updatedAt: new Date(0).toISOString(), ratings: [] };
  }
  return res.json();
}

export async function fetchJournals(): Promise<JournalConfig[]> {
  const res = await fetch(url("config/journals.yaml"), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load journals.yaml: ${res.status}`);
  const text = await res.text();
  const parsed = yaml.load(text) as JournalsFile;
  return parsed.journals ?? [];
}

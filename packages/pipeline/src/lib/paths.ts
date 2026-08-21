import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import type {
  CandidatesFile,
  CleanDatabase,
  CrawlMeta,
  JournalConfig,
  JournalsFile,
  RatingsFile,
  RawArticle,
} from "@journal-watch/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Repo root: packages/pipeline/src/lib -> ../../../../ */
export const REPO_ROOT = resolve(__dirname, "../../../..");

export const PATHS = {
  journalsYaml: join(REPO_ROOT, "config", "journals.yaml"),
  rawDir: join(REPO_ROOT, "data", "raw"),
  cleanFile: join(REPO_ROOT, "data", "clean", "articles.json"),
  candidatesFile: join(REPO_ROOT, "data", "candidates.json"),
  metaFile: join(REPO_ROOT, "data", "meta.json"),
  ratingsFile: join(REPO_ROOT, "data", "ratings.json"),
};

export function ensureDataDirs(): void {
  mkdirSync(PATHS.rawDir, { recursive: true });
  mkdirSync(dirname(PATHS.cleanFile), { recursive: true });
}

export function loadJournals(): JournalConfig[] {
  const raw = readFileSync(PATHS.journalsYaml, "utf8");
  const parsed = yaml.load(raw) as JournalsFile;
  if (!parsed?.journals || !Array.isArray(parsed.journals)) {
    throw new Error("Invalid journals.yaml: missing journals array");
  }
  return parsed.journals;
}

export function loadEnabledJournals(): JournalConfig[] {
  return loadJournals().filter((j) => j.enabled);
}

export function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeRawBatch(journalId: string, articles: RawArticle[]): string {
  ensureDataDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(PATHS.rawDir, `${journalId}_${stamp}.json`);
  writeJson(path, { journalId, fetchedAt: new Date().toISOString(), articles });
  return path;
}

export function loadLatestRawArticles(): RawArticle[] {
  ensureDataDirs();
  const files = readdirSync(PATHS.rawDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const byId = new Map<string, RawArticle>();
  for (const file of files) {
    const payload = readJson<{ articles: RawArticle[] }>(join(PATHS.rawDir, file), {
      articles: [],
    });
    for (const a of payload.articles ?? []) {
      byId.set(a.id, a);
    }
  }
  return [...byId.values()];
}

export function loadCleanDb(): CleanDatabase {
  return readJson<CleanDatabase>(PATHS.cleanFile, {
    updatedAt: new Date(0).toISOString(),
    articles: [],
  });
}

export function saveCleanDb(db: CleanDatabase): void {
  writeJson(PATHS.cleanFile, db);
}

export function loadMeta(): CrawlMeta {
  return readJson<CrawlMeta>(PATHS.metaFile, {
    lastCrawlAt: new Date(0).toISOString(),
    journals: {},
  });
}

export function saveMeta(meta: CrawlMeta): void {
  writeJson(PATHS.metaFile, meta);
}

export function loadRatings(): RatingsFile {
  return readJson<RatingsFile>(PATHS.ratingsFile, {
    updatedAt: new Date(0).toISOString(),
    ratings: [],
  });
}

export function loadCandidates(): CandidatesFile {
  return readJson<CandidatesFile>(PATHS.candidatesFile, {
    updatedAt: new Date(0).toISOString(),
    titlePromptId: "",
    threshold: 0.45,
    candidates: [],
  });
}

export function saveCandidates(file: CandidatesFile): void {
  writeJson(PATHS.candidatesFile, file);
}

export interface RawFileInfo {
  name: string;
  path: string;
  mtimeMs: number;
}

export function listRawFiles(): RawFileInfo[] {
  ensureDataDirs();
  return readdirSync(PATHS.rawDir)
    .filter((f) => f.endsWith(".json"))
    .map((name) => {
      const path = join(PATHS.rawDir, name);
      return { name, path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
}

export function deleteRawFile(path: string): void {
  if (existsSync(path)) unlinkSync(path);
}

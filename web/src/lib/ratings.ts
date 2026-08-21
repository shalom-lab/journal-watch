import type { ArticleRating, RatingsFile } from "@journal-watch/shared";
import { flushGithubSync, putRepoJson, scheduleGithubSync } from "./github";
import {
  LS,
  canSyncToGithub,
  loadSettings,
  saveSettings,
  type AppSettings,
} from "./settings";

export type { AppSettings } from "./settings";
export { loadSettings, saveSettings, canSyncToGithub };

export function loadDraftRatings(): RatingsFile | null {
  try {
    const raw = localStorage.getItem(LS.ratingsDraft);
    return raw ? (JSON.parse(raw) as RatingsFile) : null;
  } catch {
    return null;
  }
}

export function saveDraftRatings(file: RatingsFile): void {
  localStorage.setItem(LS.ratingsDraft, JSON.stringify(file));
}

function mergeRating(file: RatingsFile, rating: ArticleRating): RatingsFile {
  const others = file.ratings.filter((r) => r.articleId !== rating.articleId);
  return {
    updatedAt: new Date().toISOString(),
    ratings: [...others, rating].sort((a, b) => a.articleId.localeCompare(b.articleId)),
  };
}

async function pushRatings(file: RatingsFile, settings: AppSettings): Promise<void> {
  await putRepoJson(
    settings.ratingsPath,
    file,
    `chore(ratings): update ${file.updatedAt.slice(0, 10)}`,
    settings,
  );
}

export function upsertRatingLocal(
  base: RatingsFile,
  rating: ArticleRating,
  settings: AppSettings = loadSettings(),
): { file: RatingsFile; sync: "scheduled" | "manual" | "skipped" } {
  const next = mergeRating(base, rating);
  saveDraftRatings(next);
  const sync = scheduleGithubSync(
    "ratings",
    () => pushRatings(next, loadSettings()),
    settings,
  );
  return { file: next, sync };
}

export async function syncRatingsNow(
  file: RatingsFile,
  settings: AppSettings = loadSettings(),
): Promise<void> {
  saveDraftRatings(file);
  await flushGithubSync("ratings").catch(() => undefined);
  await pushRatings(file, settings);
}

export function downloadRatings(file: RatingsFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ratings.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

import type { CandidatesFile } from "@journal-watch/shared";
import { flushGithubSync, putRepoJson, scheduleGithubSync } from "./github";
import { LS, loadSettings, type AppSettings } from "./settings";

export function loadDraftCandidates(): CandidatesFile | null {
  try {
    const raw = localStorage.getItem(LS.candidatesDraft);
    return raw ? (JSON.parse(raw) as CandidatesFile) : null;
  } catch {
    return null;
  }
}

export function saveDraftCandidates(file: CandidatesFile): void {
  localStorage.setItem(LS.candidatesDraft, JSON.stringify(file));
}

async function pushCandidates(file: CandidatesFile, settings: AppSettings): Promise<void> {
  await putRepoJson(
    settings.candidatesPath,
    file,
    `chore(candidates): update human review ${file.updatedAt.slice(0, 10)}`,
    settings,
  );
}

export function saveCandidatesLocal(
  file: CandidatesFile,
  settings: AppSettings = loadSettings(),
): { file: CandidatesFile; sync: "scheduled" | "manual" | "skipped" } {
  saveDraftCandidates(file);
  const sync = scheduleGithubSync(
    "candidates",
    () => pushCandidates(file, loadSettings()),
    settings,
  );
  return { file, sync };
}

export async function syncCandidatesNow(
  file: CandidatesFile,
  settings: AppSettings = loadSettings(),
): Promise<void> {
  saveDraftCandidates(file);
  await flushGithubSync("candidates").catch(() => undefined);
  await pushCandidates(file, settings);
}

export function downloadCandidates(file: CandidatesFile): void {
  const blob = new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "candidates.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

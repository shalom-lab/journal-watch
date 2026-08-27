import { flushGithubSync, putRepoJson, putRepoText, scheduleGithubSync } from "./github";
import { LS, canSyncToGithub, loadSettings, type AppSettings } from "./settings";

export type PromptStage = "title" | "detail";

export interface PromptIndex {
  active: {
    titleScreen: string;
    detailScreen: string;
  };
  prompts: Record<
    string,
    {
      file: string;
      stage: PromptStage;
      description?: string;
    }
  >;
}

/** Local editable snapshot of prompts/index.json + md bodies. */
export interface PromptsDraft {
  updatedAt: string;
  index: PromptIndex;
  /** prompt id → markdown body */
  bodies: Record<string, string>;
}

const base = import.meta.env.BASE_URL;

function url(path: string): string {
  return `${base}${path.replace(/^\//, "")}`;
}

export function loadDraftPrompts(): PromptsDraft | null {
  try {
    const raw = localStorage.getItem(LS.promptsDraft);
    return raw ? (JSON.parse(raw) as PromptsDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraftPrompts(draft: PromptsDraft): void {
  localStorage.setItem(LS.promptsDraft, JSON.stringify(draft));
}

export async function fetchPromptsBundle(): Promise<PromptsDraft> {
  const indexRes = await fetch(url("prompts/index.json"), { cache: "no-store" });
  if (!indexRes.ok) throw new Error(`Failed to load prompts/index.json: ${indexRes.status}`);
  const index = (await indexRes.json()) as PromptIndex;

  const bodies: Record<string, string> = {};
  await Promise.all(
    Object.entries(index.prompts).map(async ([id, meta]) => {
      const res = await fetch(url(`prompts/${meta.file}`), { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load prompts/${meta.file}: ${res.status}`);
      bodies[id] = await res.text();
    }),
  );

  return {
    updatedAt: new Date().toISOString(),
    index,
    bodies,
  };
}

export function listPromptIds(index: PromptIndex, stage?: PromptStage): string[] {
  return Object.entries(index.prompts)
    .filter(([, m]) => (stage ? m.stage === stage : true))
    .map(([id]) => id)
    .sort();
}

async function pushPrompts(draft: PromptsDraft, settings: AppSettings): Promise<void> {
  await putRepoJson(
    "prompts/index.json",
    draft.index,
    `chore(prompts): update index ${draft.updatedAt.slice(0, 10)}`,
    settings,
  );
  for (const [id, meta] of Object.entries(draft.index.prompts)) {
    const body = draft.bodies[id];
    if (body == null) continue;
    const text = body.endsWith("\n") ? body : `${body}\n`;
    await putRepoText(
      `prompts/${meta.file}`,
      text,
      `chore(prompts): update ${meta.file}`,
      settings,
    );
  }
}

export function savePromptsLocal(
  draft: PromptsDraft,
  settings: AppSettings = loadSettings(),
): { draft: PromptsDraft; sync: "scheduled" | "manual" | "skipped" } {
  const next = { ...draft, updatedAt: new Date().toISOString() };
  saveDraftPrompts(next);
  const sync = scheduleGithubSync(
    "prompts",
    () => pushPrompts(next, loadSettings()),
    settings,
  );
  return { draft: next, sync };
}

export async function syncPromptsNow(
  draft: PromptsDraft,
  settings: AppSettings = loadSettings(),
): Promise<void> {
  if (!canSyncToGithub(settings)) {
    throw new Error("GitHub PAT / owner/repo not configured");
  }
  const next = { ...draft, updatedAt: new Date().toISOString() };
  saveDraftPrompts(next);
  await flushGithubSync("prompts").catch(() => undefined);
  await pushPrompts(next, settings);
}

export function downloadPromptMarkdown(filename: string, body: string): void {
  const blob = new Blob([body.endsWith("\n") ? body : `${body}\n`], {
    type: "text/markdown;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

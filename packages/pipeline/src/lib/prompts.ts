import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./paths.js";

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

export interface LoadedPrompt {
  id: string;
  stage: PromptStage;
  body: string;
  description?: string;
}

const PROMPTS_DIR = join(REPO_ROOT, "prompts");

export function loadPromptIndex(): PromptIndex {
  const path = join(PROMPTS_DIR, "index.json");
  if (!existsSync(path)) {
    throw new Error(`Missing prompts/index.json at ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as PromptIndex;
}

/** Load the active prompt for a stage (title | detail). */
export function loadActivePrompt(stage: "titleScreen" | "detailScreen"): LoadedPrompt {
  const index = loadPromptIndex();
  const id = index.active[stage];
  const meta = index.prompts[id];
  if (!meta) {
    throw new Error(`Prompt id "${id}" not found in prompts/index.json`);
  }
  const filePath = join(PROMPTS_DIR, meta.file);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt file missing: ${filePath}`);
  }
  return {
    id,
    stage: meta.stage,
    body: readFileSync(filePath, "utf8"),
    description: meta.description,
  };
}

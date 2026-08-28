import { canSyncToGithub, loadSettings, parseRepoFull, type AppSettings } from "./settings";

export type WorkflowId =
  | "fetch-raw"
  | "screen-title"
  | "fetch-detail"
  | "prune-raw"
  | "pipeline"
  | "deploy-pages";

export interface WorkflowJob {
  id: WorkflowId;
  /** workflow file name under .github/workflows/ */
  file: string;
  /** whether this workflow accepts skip_commit input */
  hasSkipCommit: boolean;
}

export const WORKFLOW_JOBS: WorkflowJob[] = [
  { id: "fetch-raw", file: "fetch-raw.yml", hasSkipCommit: true },
  { id: "screen-title", file: "screen-title.yml", hasSkipCommit: true },
  { id: "fetch-detail", file: "fetch-detail.yml", hasSkipCommit: true },
  { id: "prune-raw", file: "prune-raw.yml", hasSkipCommit: true },
  { id: "pipeline", file: "pipeline.yml", hasSkipCommit: true },
  { id: "deploy-pages", file: "deploy-pages.yml", hasSkipCommit: false },
];

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  displayTitle: string;
  path: string;
}

function ghHeaders(settings: AppSettings): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${settings.pat}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function repoParts(settings: AppSettings): { owner: string; repo: string } {
  if (!canSyncToGithub(settings)) {
    throw new Error("GitHub PAT / owner/repo not configured");
  }
  const parsed = parseRepoFull(settings.repoFull);
  if (!parsed) throw new Error(`Invalid repo: ${settings.repoFull} (expected owner/repo)`);
  return parsed;
}

/** Trigger a workflow_dispatch on master. */
export async function dispatchWorkflow(
  job: WorkflowJob,
  opts: { skipCommit?: boolean; ref?: string } = {},
  settings: AppSettings = loadSettings(),
): Promise<void> {
  const { owner, repo } = repoParts(settings);
  const ref = opts.ref ?? "master";
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${job.file}/dispatches`;

  const body: { ref: string; inputs?: Record<string, string> } = { ref };
  if (job.hasSkipCommit) {
    body.inputs = { skip_commit: opts.skipCommit ? "true" : "false" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { ...ghHeaders(settings), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 204) return;
  const text = await res.text();
  if (res.status === 404) {
    throw new Error(
      `Workflow ${job.file} not found or PAT missing actions:write (HTTP 404)`,
    );
  }
  if (res.status === 403) {
    throw new Error(`Forbidden — PAT needs actions:write on this repo (HTTP 403) ${text}`);
  }
  throw new Error(`Dispatch ${job.file} failed: ${res.status} ${text}`);
}

/** List recent workflow runs for the configured repo. */
export async function listRecentRuns(
  limit = 12,
  settings: AppSettings = loadSettings(),
): Promise<WorkflowRun[]> {
  const { owner, repo } = repoParts(settings);
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;
  const res = await fetch(url, { headers: ghHeaders(settings) });
  if (!res.ok) {
    throw new Error(`List runs failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    workflow_runs: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      created_at: string;
      updated_at: string;
      display_title: string;
      path: string;
    }>;
  };
  return data.workflow_runs.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    htmlUrl: r.html_url,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    displayTitle: r.display_title,
    path: r.path,
  }));
}

export function actionsTabUrl(settings: AppSettings = loadSettings()): string | null {
  const parsed = parseRepoFull(settings.repoFull);
  if (!parsed) return null;
  return `https://github.com/${parsed.owner}/${parsed.repo}/actions`;
}

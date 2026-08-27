import { canSyncToGithub, loadSettings, parseRepoFull, type AppSettings } from "./settings";

/** Write a UTF-8 text file to the repo via Contents API. */
export async function putRepoText(
  path: string,
  text: string,
  message: string,
  settings: AppSettings = loadSettings(),
): Promise<void> {
  if (!canSyncToGithub(settings)) {
    throw new Error("GitHub PAT / owner/repo not configured");
  }

  const parsed = parseRepoFull(settings.repoFull);
  if (!parsed) throw new Error(`Invalid repo: ${settings.repoFull} (expected owner/repo)`);

  const apiBase = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${path}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${settings.pat}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const getRes = await fetch(apiBase, { headers });
  let sha: string | undefined;
  if (getRes.ok) {
    sha = ((await getRes.json()) as { sha: string }).sha;
  } else if (getRes.status !== 404) {
    throw new Error(`GitHub GET ${path} failed: ${getRes.status}`);
  }

  const content = btoa(unescape(encodeURIComponent(text)));
  const putRes = await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ message, content, sha }),
  });

  if (!putRes.ok) {
    throw new Error(`GitHub PUT ${path} failed: ${putRes.status} ${await putRes.text()}`);
  }
}

export async function putRepoJson(
  path: string,
  data: unknown,
  message: string,
  settings: AppSettings = loadSettings(),
): Promise<void> {
  await putRepoText(path, `${JSON.stringify(data, null, 2)}\n`, message, settings);
}

type Timer = ReturnType<typeof setTimeout>;

const pending = new Map<string, { timer: Timer | null; run: () => Promise<void> }>();

/** Coalesce rapid edits into one GitHub PUT. */
export function scheduleGithubSync(
  key: string,
  run: () => Promise<void>,
  settings: AppSettings = loadSettings(),
): "scheduled" | "manual" | "skipped" {
  if (!canSyncToGithub(settings)) return "skipped";

  const existing = pending.get(key);
  if (existing?.timer) clearTimeout(existing.timer);

  if (settings.syncMode === "manual") {
    pending.set(key, { timer: null, run });
    return "manual";
  }

  const timer = setTimeout(() => {
    void (async () => {
      pending.delete(key);
      await run();
    })();
  }, settings.syncDebounceMs);

  pending.set(key, { timer, run });
  return "scheduled";
}

export async function flushGithubSync(key: string): Promise<boolean> {
  const item = pending.get(key);
  if (!item) return false;
  if (item.timer) clearTimeout(item.timer);
  pending.delete(key);
  await item.run();
  return true;
}

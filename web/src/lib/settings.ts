/** Flat localStorage keys — inject before page load; read on every startup. */
export const LS = {
  token: "gh_token_journal-watch",
  /** "owner/repo" (or full https://github.com/owner/repo URL) */
  repo: "gh_repo_journal-watch",
  /** optional legacy: separate owner if repo key is bare name */
  legacyOwner: "gh_owner_journal-watch",
  syncMode: "jw_sync_mode",
  syncDebounceMs: "jw_sync_debounce_ms",
  lang: "jw.lang",
  ratingsDraft: "jw.ratings.draft",
  candidatesDraft: "jw.candidates.draft",
  promptsDraft: "jw.prompts.draft",
  legacySettings: "jw.settings",
} as const;

export type SyncMode = "auto" | "manual";

export interface AppSettings {
  /** GitHub PAT (contents:write). Optional for browse-only. */
  pat: string;
  /** "owner/repo" */
  repoFull: string;
  ratingsPath: string;
  candidatesPath: string;
  syncMode: SyncMode;
  syncDebounceMs: number;
}

export interface SettingsBootstrapStatus {
  hasToken: boolean;
  hasRepo: boolean;
  canSync: boolean;
  /** masked for UI, never the raw secret */
  repoFull: string;
}

let bootstrapped = false;
let lastStatus: SettingsBootstrapStatus = {
  hasToken: false,
  hasRepo: false,
  canSync: false,
  repoFull: "",
};

export function defaultSettings(): AppSettings {
  return {
    pat: "",
    repoFull: "",
    ratingsPath: "data/ratings.json",
    candidatesPath: "data/candidates.json",
    syncMode: "auto",
    syncDebounceMs: 2500,
  };
}

/** Parse "owner/repo" → { owner, repo }. */
export function parseRepoFull(repoFull: string): { owner: string; repo: string } | null {
  const cleaned = repoFull
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) return null;
  return { owner, repo };
}

function resolveRepoFullFromStorage(): string {
  const raw = (localStorage.getItem(LS.repo) ?? "").trim();
  if (raw && parseRepoFull(raw)) return raw;

  // legacy: owner + bare repo name
  const owner = (localStorage.getItem(LS.legacyOwner) ?? "").trim();
  if (owner && raw && !raw.includes("/")) {
    const combined = `${owner}/${raw}`;
    localStorage.setItem(LS.repo, combined);
    return combined;
  }

  try {
    const legacyRaw = localStorage.getItem(LS.legacySettings);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as {
        pat?: string;
        owner?: string;
        repo?: string;
        repoFull?: string;
      };
      if (legacy.pat && !localStorage.getItem(LS.token)) {
        localStorage.setItem(LS.token, legacy.pat);
      }
      if (legacy.repoFull && parseRepoFull(legacy.repoFull)) {
        localStorage.setItem(LS.repo, legacy.repoFull.trim());
        return legacy.repoFull.trim();
      }
      if (legacy.owner && legacy.repo) {
        const combined = `${legacy.owner}/${legacy.repo}`;
        localStorage.setItem(LS.repo, combined);
        return combined;
      }
    }
  } catch {
    /* ignore */
  }

  return raw;
}

/** Always re-read localStorage (supports pre-injected keys before / during session). */
export function loadSettings(): AppSettings {
  const syncModeRaw = localStorage.getItem(LS.syncMode);
  const debounceRaw = Number(localStorage.getItem(LS.syncDebounceMs) ?? "2500");
  return {
    ...defaultSettings(),
    pat: (localStorage.getItem(LS.token) ?? "").trim(),
    repoFull: resolveRepoFullFromStorage(),
    syncMode: syncModeRaw === "manual" ? "manual" : "auto",
    syncDebounceMs:
      Number.isFinite(debounceRaw) && debounceRaw >= 500 ? debounceRaw : 2500,
  };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(LS.token, settings.pat.trim());
  localStorage.setItem(LS.repo, settings.repoFull.trim());
  localStorage.setItem(LS.syncMode, settings.syncMode);
  localStorage.setItem(LS.syncDebounceMs, String(settings.syncDebounceMs));
  // refresh status cache after manual save
  lastStatus = describeSettings(loadSettings());
}

export function canSyncToGithub(settings: AppSettings = loadSettings()): boolean {
  return Boolean(settings.pat && parseRepoFull(settings.repoFull));
}

export function describeSettings(settings: AppSettings = loadSettings()): SettingsBootstrapStatus {
  const parsed = parseRepoFull(settings.repoFull);
  return {
    hasToken: Boolean(settings.pat),
    hasRepo: Boolean(parsed),
    canSync: Boolean(settings.pat && parsed),
    repoFull: parsed ? `${parsed.owner}/${parsed.repo}` : settings.repoFull.trim(),
  };
}

/**
 * Call once before React render: read pre-injected localStorage token / repo.
 * Safe to call again — re-reads storage.
 */
export function bootstrapSettings(): SettingsBootstrapStatus {
  const settings = loadSettings();
  lastStatus = describeSettings(settings);
  bootstrapped = true;
  if (import.meta.env.DEV) {
    console.info(
      "[settings]",
      lastStatus.canSync
        ? `ready → ${lastStatus.repoFull}`
        : `browse-only (token=${lastStatus.hasToken}, repo=${lastStatus.hasRepo})`,
    );
  }
  return lastStatus;
}

export function getSettingsStatus(): SettingsBootstrapStatus {
  if (!bootstrapped) return bootstrapSettings();
  // re-read in case keys were injected after first paint
  return describeSettings(loadSettings());
}

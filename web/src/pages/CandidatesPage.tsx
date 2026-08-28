import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  CandidateArticle,
  CandidateDecision,
  CandidatesFile,
  JournalConfig,
} from "@journal-watch/shared";
import { fetchCandidates, fetchJournals } from "../lib/data";
import {
  downloadCandidates,
  loadDraftCandidates,
  saveCandidatesLocal,
  syncCandidatesNow,
} from "../lib/candidates";
import { canSyncToGithub, loadSettings } from "../lib/settings";

function scoreOf(c: CandidateArticle): number {
  return c.humanScore ?? c.aiScore;
}

export default function CandidatesPage() {
  const { t } = useTranslation();
  const [file, setFile] = useState<CandidatesFile | null>(null);
  const [filter, setFilter] = useState<"all" | CandidateDecision>("all");
  const [journalFilter, setJournalFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [q, setQ] = useState("");
  const [journals, setJournals] = useState<JournalConfig[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [remote, j] = await Promise.all([fetchCandidates(), fetchJournals()]);
        const draft = loadDraftCandidates();
        if (draft && draft.updatedAt > (remote.updatedAt || "")) {
          setFile(draft);
          setDirty(true);
        } else {
          setFile(remote);
        }
        setJournals(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const journalOptions = useMemo(() => {
    if (!file) return [];
    const ids = new Set(file.candidates.map((c) => c.journalId));
    const nameById = new Map(journals.map((j) => [j.id, j.name]));
    return [...ids]
      .sort((a, b) => (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b))
      .map((id) => ({ id, name: nameById.get(id) ?? id }));
  }, [file, journals]);

  const list = useMemo(() => {
    if (!file) return [];
    const query = q.trim().toLowerCase();
    return file.candidates
      .filter((c) => (filter === "all" ? true : c.decision === filter))
      .filter((c) => (journalFilter === "all" ? true : c.journalId === journalFilter))
      .filter((c) => scoreOf(c) >= minScore)
      .filter((c) => {
        if (!query) return true;
        return `${c.title} ${c.summaryZh} ${c.reason}`.toLowerCase().includes(query);
      })
      .sort((a, b) => scoreOf(b) - scoreOf(a));
  }, [file, filter, journalFilter, minScore, q]);

  function patch(
    articleId: string,
    next: Partial<Pick<CandidateArticle, "decision" | "humanScore" | "note">>,
  ) {
    if (!file) return;
    setError(null);
    const now = new Date().toISOString();
    const updated: CandidatesFile = {
      ...file,
      updatedAt: now,
      candidates: file.candidates.map((c) =>
        c.articleId === articleId ? { ...c, ...next, updatedAt: now } : c,
      ),
    };
    const { sync } = saveCandidatesLocal(updated);
    setFile(updated);
    setDirty(sync !== "skipped");
    if (sync === "scheduled") setStatus(t("sync.pendingAuto"));
    else if (sync === "manual") setStatus(t("sync.pendingManual"));
    else setStatus(t("candidates.saveLocal"));
  }

  async function onSync() {
    if (!file) return;
    setSyncing(true);
    setError(null);
    try {
      await syncCandidatesNow(file);
      setDirty(false);
      setStatus(t("candidates.saveOk"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  if (error && !file) return <p className="error">{error}</p>;
  if (!file) return <p className="muted">Loading…</p>;

  const canSync = canSyncToGithub(loadSettings());
  const keepN = file.candidates.filter((c) => c.decision === "keep").length;
  const dropN = file.candidates.filter((c) => c.decision === "drop").length;
  const pendingN = file.candidates.filter((c) => c.decision === "pending").length;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>{t("candidates.title")}</h1>
          <p className="muted">
            {t("candidates.hint")} · {t("candidates.showing", {
              shown: list.length,
              total: file.candidates.length,
            })}{" "}
            · keep {keepN} / drop {dropN} / pending {pendingN}
          </p>
        </div>
        <div className="btn-row">
          {canSync && (
            <button
              type="button"
              className="star on"
              disabled={syncing || !dirty}
              onClick={() => void onSync()}
            >
              {syncing ? t("sync.syncing") : t("sync.now")}
            </button>
          )}
          <button type="button" className="ghost" onClick={() => downloadCandidates(file)}>
            {t("candidates.download")}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <label className="filter-journal">
          {t("candidates.filterJournal")}
          <select value={journalFilter} onChange={(e) => setJournalFilter(e.target.value)}>
            <option value="all">{t("candidates.allJournals")}</option>
            {journalOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("candidates.filter")}
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">{t("candidates.all")}</option>
            <option value="pending">{t("candidates.pending")}</option>
            <option value="keep">{t("candidates.keep")}</option>
            <option value="drop">{t("candidates.drop")}</option>
          </select>
        </label>
        <label>
          {t("candidates.minScore")}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
          <span>{minScore.toFixed(2)}</span>
        </label>
        <input
          className="search"
          placeholder={t("candidates.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {status && <p className="ok">{status}</p>}
      {error && <p className="error">{error}</p>}

      {list.length === 0 ? (
        <p className="muted">{t("candidates.empty")}</p>
      ) : (
        <ul className="article-list article-list-2col">
          {list.map((c) => (
            <li key={c.articleId} className="article">
              <div className="article-meta">
                <span className="pill">{c.journalId}</span>
                <span className="muted">{c.publishedAt ?? "—"}</span>
                <span className="score">
                  AI {(c.aiScore * 100).toFixed(0)}%
                  {c.humanScore != null
                    ? ` · ${t("candidates.human")} ${(c.humanScore * 100).toFixed(0)}%`
                    : ""}
                </span>
                <span className="pill">{t(`candidates.${c.decision}`)}</span>
              </div>
              <h2>
                <a href={c.url} target="_blank" rel="noreferrer">
                  {c.title}
                </a>
              </h2>
              <p className="summary">{c.summaryZh || c.reason}</p>
              <div className="rate-row">
                <button
                  type="button"
                  className={c.decision === "keep" ? "star on" : "star"}
                  onClick={() => patch(c.articleId, { decision: "keep" })}
                >
                  {t("candidates.keep")}
                </button>
                <button
                  type="button"
                  className={c.decision === "drop" ? "star on" : "star"}
                  onClick={() => patch(c.articleId, { decision: "drop" })}
                >
                  {t("candidates.drop")}
                </button>
                <button
                  type="button"
                  className={c.decision === "pending" ? "star on" : "star"}
                  onClick={() => patch(c.articleId, { decision: "pending" })}
                >
                  {t("candidates.pending")}
                </button>
                <label>
                  {t("candidates.human")}
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={c.humanScore ?? ""}
                    placeholder={String(c.aiScore)}
                    onChange={(e) => {
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      patch(c.articleId, {
                        humanScore: v != null && Number.isFinite(v) ? v : undefined,
                      });
                    }}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

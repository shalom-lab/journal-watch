import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  WORKFLOW_JOBS,
  actionsTabUrl,
  dispatchWorkflow,
  listRecentRuns,
  type WorkflowId,
  type WorkflowJob,
  type WorkflowRun,
} from "../lib/actions";
import { canSyncToGithub, loadSettings } from "../lib/settings";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusLabel(run: WorkflowRun): string {
  if (run.status !== "completed") return run.status;
  return run.conclusion ?? "completed";
}

export default function JobsPage() {
  const { t } = useTranslation();
  const [skipCommit, setSkipCommit] = useState(false);
  const [busyId, setBusyId] = useState<WorkflowId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);

  const canRun = canSyncToGithub(loadSettings());
  const actionsUrl = actionsTabUrl();

  const refreshRuns = useCallback(async () => {
    if (!canSyncToGithub(loadSettings())) {
      setRuns([]);
      return;
    }
    setLoadingRuns(true);
    setError(null);
    try {
      setRuns(await listRecentRuns(12));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  async function onRun(job: WorkflowJob) {
    setBusyId(job.id);
    setError(null);
    setStatus(null);
    try {
      await dispatchWorkflow(job, { skipCommit });
      setStatus(t("jobs.dispatched", { name: t(`jobs.${job.id}.label`) }));
      window.setTimeout(() => void refreshRuns(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>{t("jobs.title")}</h1>
          <p className="muted">{t("jobs.hint")}</p>
        </div>
        <div className="btn-row">
          {actionsUrl && (
            <a className="ghost" href={actionsUrl} target="_blank" rel="noreferrer">
              {t("jobs.openActions")}
            </a>
          )}
          <button
            type="button"
            className="ghost"
            disabled={!canRun || loadingRuns}
            onClick={() => void refreshRuns()}
          >
            {loadingRuns ? t("jobs.refreshing") : t("jobs.refresh")}
          </button>
        </div>
      </div>

      {!canRun && <p className="error">{t("jobs.needPat")}</p>}

      <label className="jobs-skip">
        <input
          type="checkbox"
          checked={skipCommit}
          onChange={(e) => setSkipCommit(e.target.checked)}
          disabled={!canRun}
        />
        {t("jobs.skipCommit")}
      </label>

      <div className="jobs-grid">
        {WORKFLOW_JOBS.map((job) => (
          <article key={job.id} className="job-card">
            <div className="job-card-head">
              <strong className="job-label">{t(`jobs.${job.id}.label`)}</strong>
              <code className="mono">{job.file}</code>
            </div>
            <p className="muted job-desc">{t(`jobs.${job.id}.desc`)}</p>
            <button
              type="button"
              className="star on"
              disabled={!canRun || busyId !== null}
              onClick={() => void onRun(job)}
            >
              {busyId === job.id ? t("jobs.triggering") : t("jobs.run")}
            </button>
          </article>
        ))}
      </div>

      {status && <p className="ok">{status}</p>}
      {error && <p className="error">{error}</p>}

      <h2 className="jobs-runs-title">{t("jobs.recent")}</h2>
      {runs.length === 0 ? (
        <p className="muted">{canRun ? t("jobs.noRuns") : t("jobs.needPat")}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("jobs.colName")}</th>
                <th>{t("jobs.colStatus")}</th>
                <th>{t("jobs.colTime")}</th>
                <th>{t("jobs.colLink")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="pill">{r.name}</span> {r.displayTitle}
                  </td>
                  <td>
                    <span
                      className={`run-status ${
                        r.conclusion === "success"
                          ? "ok"
                          : r.conclusion === "failure"
                            ? "fail"
                            : "pending"
                      }`}
                    >
                      {statusLabel(r)}
                    </span>
                  </td>
                  <td className="muted">{formatTime(r.createdAt)}</td>
                  <td>
                    <a href={r.htmlUrl} target="_blank" rel="noreferrer">
                      {t("jobs.view")}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

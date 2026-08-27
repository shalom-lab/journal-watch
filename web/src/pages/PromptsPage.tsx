import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  downloadPromptMarkdown,
  fetchPromptsBundle,
  listPromptIds,
  loadDraftPrompts,
  savePromptsLocal,
  syncPromptsNow,
  type PromptsDraft,
} from "../lib/prompts";
import { canSyncToGithub, loadSettings } from "../lib/settings";

export default function PromptsPage() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PromptsDraft | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const remote = await fetchPromptsBundle();
        const local = loadDraftPrompts();
        if (local) {
          setDraft(local);
          setDirty(true);
          setSelectedId(Object.keys(local.index.prompts)[0] ?? "");
        } else {
          setDraft(remote);
          setSelectedId(Object.keys(remote.index.prompts)[0] ?? "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const ids = useMemo(
    () => (draft ? listPromptIds(draft.index) : []),
    [draft],
  );

  const selected = draft && selectedId ? draft.index.prompts[selectedId] : undefined;
  const body = draft && selectedId ? (draft.bodies[selectedId] ?? "") : "";
  const canSync = canSyncToGithub(loadSettings());

  function persist(next: PromptsDraft) {
    setError(null);
    const { draft: saved, sync } = savePromptsLocal(next);
    setDraft(saved);
    setDirty(sync !== "skipped");
    if (sync === "scheduled") setStatus(t("sync.pendingAuto"));
    else if (sync === "manual") setStatus(t("sync.pendingManual"));
    else setStatus(t("prompts.saveLocal"));
  }

  function onBodyChange(value: string) {
    if (!draft || !selectedId) return;
    persist({
      ...draft,
      bodies: { ...draft.bodies, [selectedId]: value },
    });
  }

  function onActiveChange(slot: "titleScreen" | "detailScreen", id: string) {
    if (!draft) return;
    persist({
      ...draft,
      index: {
        ...draft.index,
        active: { ...draft.index.active, [slot]: id },
      },
    });
  }

  async function onSync() {
    if (!draft) return;
    setSyncing(true);
    setError(null);
    try {
      await syncPromptsNow(draft);
      setDirty(false);
      setStatus(t("prompts.saveOk"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  if (error && !draft) return <p className="error">{error}</p>;
  if (!draft) return <p className="muted">Loading…</p>;

  const titleIds = listPromptIds(draft.index, "title");
  const detailIds = listPromptIds(draft.index, "detail");

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>{t("prompts.title")}</h1>
          <p className="muted">{t("prompts.hint")}</p>
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
          {selected && (
            <button
              type="button"
              className="ghost"
              onClick={() => downloadPromptMarkdown(selected.file, body)}
            >
              {t("prompts.download")}
            </button>
          )}
        </div>
      </div>

      <div className="toolbar prompts-toolbar">
        <label>
          {t("prompts.activeTitle")}
          <select
            value={draft.index.active.titleScreen}
            onChange={(e) => onActiveChange("titleScreen", e.target.value)}
          >
            {titleIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("prompts.activeDetail")}
          <select
            value={draft.index.active.detailScreen}
            onChange={(e) => onActiveChange("detailScreen", e.target.value)}
          >
            {detailIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("prompts.edit")}
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {id}
                {id === draft.index.active.titleScreen || id === draft.index.active.detailScreen
                  ? " ★"
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected && (
        <p className="muted prompts-meta">
          <span className="pill on">{selected.stage}</span>{" "}
          <code>{selected.file}</code>
          {selected.description ? ` — ${selected.description}` : ""}
        </p>
      )}

      {status && <p className="ok">{status}</p>}
      {error && <p className="error">{error}</p>}

      <textarea
        className="prompt-editor"
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        spellCheck={false}
        rows={22}
        placeholder={t("prompts.placeholder")}
      />
    </section>
  );
}

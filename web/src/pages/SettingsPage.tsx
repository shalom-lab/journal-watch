import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import {
  LS,
  getSettingsStatus,
  loadSettings,
  saveSettings,
  type AppSettings,
  type SyncMode,
} from "../lib/settings";

export default function SettingsPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<AppSettings>(() => loadSettings());
  const [saved, setSaved] = useState(false);
  const status = getSettingsStatus();

  function onSave(e: FormEvent) {
    e.preventDefault();
    saveSettings(form);
    setForm(loadSettings());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  function setLang(lang: "zh" | "en") {
    void i18n.changeLanguage(lang);
    localStorage.setItem(LS.lang, lang);
  }

  return (
    <section className="panel">
      <h1>{t("settings.title")}</h1>
      <p className="muted">
        {status.canSync
          ? t("settings.syncReady", { repo: status.repoFull })
          : t("settings.syncBrowseOnly")}
      </p>

      <div className="settings-block">
        <label>{t("settings.language")}</label>
        <div className="lang-row">
          <button
            type="button"
            className={i18n.language?.startsWith("zh") ? "star on" : "star"}
            onClick={() => setLang("zh")}
          >
            中文
          </button>
          <button
            type="button"
            className={i18n.language?.startsWith("en") ? "star on" : "star"}
            onClick={() => setLang("en")}
          >
            English
          </button>
        </div>
      </div>

      <form className="settings-form" onSubmit={onSave}>
        <p className="muted">{t("settings.patHint")}</p>
        <p className="muted mono">{t("settings.storageKeys")}</p>

        <label>
          {t("settings.pat")}
          <input
            type="password"
            autoComplete="off"
            value={form.pat}
            onChange={(e) => setForm({ ...form, pat: e.target.value })}
            placeholder="ghp_… or github_pat_…"
          />
        </label>
        <label>
          {t("settings.repoFull")}
          <input
            value={form.repoFull}
            onChange={(e) => setForm({ ...form, repoFull: e.target.value })}
            placeholder="owner/journal-watch"
          />
        </label>

        <fieldset className="sync-fieldset">
          <legend>{t("settings.syncMode")}</legend>
          <label className="radio">
            <input
              type="radio"
              name="syncMode"
              checked={form.syncMode === "auto"}
              onChange={() => setForm({ ...form, syncMode: "auto" satisfies SyncMode })}
            />
            {t("settings.syncAuto")}
          </label>
          <label className="radio">
            <input
              type="radio"
              name="syncMode"
              checked={form.syncMode === "manual"}
              onChange={() => setForm({ ...form, syncMode: "manual" })}
            />
            {t("settings.syncManual")}
          </label>
          {form.syncMode === "auto" && (
            <label>
              {t("settings.debounceMs")}
              <input
                type="number"
                min={500}
                step={500}
                value={form.syncDebounceMs}
                onChange={(e) =>
                  setForm({
                    ...form,
                    syncDebounceMs: Math.max(500, Number(e.target.value) || 2500),
                  })
                }
              />
            </label>
          )}
        </fieldset>

        <button type="submit">{t("settings.save")}</button>
        {saved && <span className="ok">{t("settings.saved")}</span>}
      </form>
    </section>
  );
}

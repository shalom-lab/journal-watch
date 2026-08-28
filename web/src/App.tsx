import { NavLink, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSettingsStatus } from "./lib/settings";
import ArticlesPage from "./pages/ArticlesPage";
import CandidatesPage from "./pages/CandidatesPage";
import JobsPage from "./pages/JobsPage";
import JournalsPage from "./pages/JournalsPage";
import PromptsPage from "./pages/PromptsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const { t } = useTranslation();
  const sync = getSettingsStatus();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-wrap">
          <span className="brand-mark" aria-hidden />
          <strong className="brand">{t("appName")}</strong>
        </div>
        <nav className="nav" aria-label="primary">
          <NavLink to="/" end>
            {t("nav.articles")}
          </NavLink>
          <NavLink to="/candidates">{t("nav.candidates")}</NavLink>
          <NavLink to="/journals">{t("nav.journals")}</NavLink>
          <NavLink to="/jobs">{t("nav.jobs")}</NavLink>
          <NavLink to="/prompts">{t("nav.prompts")}</NavLink>
          <NavLink to="/settings">{t("nav.settings")}</NavLink>
        </nav>
        <div className="topbar-end">
          <span
            className={`sync-chip ${sync.canSync ? "ready" : ""}`}
            title={sync.repoFull || undefined}
          >
            <span className="sync-dot" aria-hidden />
            {sync.canSync
              ? t("settings.syncReady", { repo: sync.repoFull })
              : t("settings.syncBrowseOnly")}
          </span>
          <a
            className="github-link"
            href="https://github.com/shalom-lab/journal-watch"
            target="_blank"
            rel="noreferrer"
            aria-label={t("nav.githubRepo")}
            title={t("nav.githubRepo")}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
          </a>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<ArticlesPage />} />
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/journals" element={<JournalsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/prompts" element={<PromptsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

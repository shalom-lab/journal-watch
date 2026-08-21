import { NavLink, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSettingsStatus } from "./lib/settings";
import ArticlesPage from "./pages/ArticlesPage";
import CandidatesPage from "./pages/CandidatesPage";
import JournalsPage from "./pages/JournalsPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const { t } = useTranslation();
  const sync = getSettingsStatus();

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-bg" aria-hidden />
        <div className="hero-inner">
          <p className="brand">{t("appName")}</p>
          <p className="tagline">{t("tagline")}</p>
          <p className="muted sync-status">
            {sync.canSync
              ? t("settings.syncReady", { repo: sync.repoFull })
              : t("settings.syncBrowseOnly")}
          </p>
          <nav className="nav">
            <NavLink to="/" end>
              {t("nav.articles")}
            </NavLink>
            <NavLink to="/candidates">{t("nav.candidates")}</NavLink>
            <NavLink to="/journals">{t("nav.journals")}</NavLink>
            <NavLink to="/settings">{t("nav.settings")}</NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<ArticlesPage />} />
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/journals" element={<JournalsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

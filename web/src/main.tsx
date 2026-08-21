import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { bootstrapSettings } from "./lib/settings";
import "./i18n";
import "./styles.css";

// Read pre-injected gh_token_journal-watch / gh_repo_journal-watch before UI mounts
bootstrapSettings();

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename === "/" ? undefined : basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

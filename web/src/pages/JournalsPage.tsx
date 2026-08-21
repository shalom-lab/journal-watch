import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CrawlMeta, JournalConfig } from "@journal-watch/shared";
import { fetchJournals, fetchMeta } from "../lib/data";

function formatDate(iso?: string): string {
  if (!iso || iso.startsWith("1970")) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function JournalsPage() {
  const { t } = useTranslation();
  const [journals, setJournals] = useState<JournalConfig[]>([]);
  const [meta, setMeta] = useState<CrawlMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [j, m] = await Promise.all([fetchJournals(), fetchMeta()]);
        setJournals(j);
        setMeta(m);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!journals.length) return <p className="muted">Loading…</p>;

  return (
    <section className="panel">
      <h1>{t("journals.title")}</h1>
      <p className="muted">
        {t("journals.lastCrawl")}: {formatDate(meta?.lastCrawlAt)}
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("journals.tier")}</th>
              <th>ID</th>
              <th>Name</th>
              <th>{t("journals.adapter")}</th>
              <th>Status</th>
              <th>{t("journals.raw")}</th>
              <th>{t("journals.kept")}</th>
              <th>{t("journals.lastCrawl")}</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((j) => {
              const stats = meta?.journals[j.id];
              return (
                <tr key={j.id} className={j.enabled ? "" : "dim"}>
                  <td>{j.tier}</td>
                  <td>
                    <code>{j.id}</code>
                  </td>
                  <td>
                    {j.homepageUrl ? (
                      <a href={j.homepageUrl} target="_blank" rel="noreferrer">
                        {j.name}
                      </a>
                    ) : (
                      j.name
                    )}
                  </td>
                  <td>{j.adapter}</td>
                  <td>
                    <span className={j.enabled ? "pill on" : "pill"}>
                      {j.enabled ? t("journals.enabled") : t("journals.disabled")}
                    </span>
                  </td>
                  <td>{stats?.rawCount ?? "—"}</td>
                  <td>{stats?.keptCount ?? "—"}</td>
                  <td title={stats?.error}>
                    {formatDate(stats?.lastCrawlAt)}
                    {stats?.error ? ` ⚠` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

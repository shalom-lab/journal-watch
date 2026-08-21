import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ArticleRating,
  CleanDatabase,
  CrawlMeta,
  CriteriaTag,
  RatingsFile,
  ScreenedArticle,
} from "@journal-watch/shared";
import { fetchArticles, fetchMeta, fetchRatings } from "../lib/data";
import {
  downloadRatings,
  loadDraftRatings,
  loadSettings,
  syncRatingsNow,
  upsertRatingLocal,
} from "../lib/ratings";
import { canSyncToGithub } from "../lib/settings";

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ArticlesPage() {
  const { t } = useTranslation();
  const [db, setDb] = useState<CleanDatabase | null>(null);
  const [meta, setMeta] = useState<CrawlMeta | null>(null);
  const [ratings, setRatings] = useState<RatingsFile>({ updatedAt: "", ratings: [] });
  const [minScore, setMinScore] = useState(0.45);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [articles, m, r] = await Promise.all([
          fetchArticles(),
          fetchMeta(),
          fetchRatings(),
        ]);
        setDb(articles);
        setMeta(m);
        const draft = loadDraftRatings();
        if (draft && draft.updatedAt > (r.updatedAt || "")) {
          setRatings(draft);
          setDirty(true);
        } else {
          setRatings(r);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const ratingMap = useMemo(() => {
    const map = new Map<string, ArticleRating>();
    for (const r of ratings.ratings) map.set(r.articleId, r);
    return map;
  }, [ratings]);

  const filtered = useMemo(() => {
    const list = db?.articles ?? [];
    const query = q.trim().toLowerCase();
    return list.filter((a) => {
      if (a.relevanceScore < minScore) return false;
      if (!query) return true;
      return `${a.title} ${a.abstract ?? ""} ${a.summaryZh}`.toLowerCase().includes(query);
    });
  }, [db, minScore, q]);

  function onRate(article: ScreenedArticle, score: 1 | 2 | 3 | 4 | 5, note: string) {
    setError(null);
    const rating: ArticleRating = {
      articleId: article.id,
      score,
      note: note || undefined,
      updatedAt: new Date().toISOString(),
    };
    const { file, sync } = upsertRatingLocal(ratings, rating, loadSettings());
    setRatings(file);
    setDirty(sync !== "skipped");
    if (sync === "scheduled") setStatus(t("sync.pendingAuto"));
    else if (sync === "manual") setStatus(t("sync.pendingManual"));
    else setStatus(t("articles.saveLocal"));
  }

  async function onSync() {
    setSyncing(true);
    setError(null);
    try {
      await syncRatingsNow(ratings);
      setDirty(false);
      setStatus(t("articles.saveOk"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  }

  if (error && !db) return <p className="error">{error}</p>;
  if (!db) return <p className="muted">Loading…</p>;

  const canSync = canSyncToGithub(loadSettings());

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h1>{t("articles.title")}</h1>
          <p className="muted">
            {t("articles.lastCrawl")}: {formatDate(meta?.lastCrawlAt)} · {filtered.length} /{" "}
            {db.articles.length}
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
          <button type="button" className="ghost" onClick={() => downloadRatings(ratings)}>
            {t("articles.download")}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <label>
          {t("articles.filterMinScore")}
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
          placeholder={t("articles.search")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {status && <p className="ok">{status}</p>}
      {error && <p className="error">{error}</p>}

      {filtered.length === 0 ? (
        <p className="muted">{t("articles.empty")}</p>
      ) : (
        <ul className="article-list">
          {filtered.map((a) => (
            <ArticleCard key={a.id} article={a} rating={ratingMap.get(a.id)} onRate={onRate} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ArticleCard({
  article,
  rating,
  onRate,
}: {
  article: ScreenedArticle;
  rating?: ArticleRating;
  onRate: (a: ScreenedArticle, score: 1 | 2 | 3 | 4 | 5, note: string) => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState(rating?.note ?? "");

  return (
    <li className="article">
      <div className="article-meta">
        <span className="pill">{article.journalId}</span>
        <span className="muted">{article.publishedAt ?? "—"}</span>
        <span className="score">
          {t("articles.score")} {(article.relevanceScore * 100).toFixed(0)}%
        </span>
      </div>
      <h2>
        <a href={article.url} target="_blank" rel="noreferrer">
          {article.title}
        </a>
      </h2>
      <p className="summary">{article.summaryZh}</p>
      {article.criteriaMatched.length > 0 && (
        <div className="tags">
          <span className="muted">{t("articles.criteria")}:</span>
          {article.criteriaMatched.map((c: CriteriaTag) => (
            <span key={c} className="tag">
              {t(`criteria.${c}`)}
            </span>
          ))}
        </div>
      )}
      <div className="rate-row">
        <span>{t("articles.rating")}</span>
        <div className="stars">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={rating?.score === n ? "star on" : "star"}
              onClick={() => onRate(article, n, note)}
            >
              {n}
            </button>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("articles.notePlaceholder")}
        />
        <a className="ghost" href={article.url} target="_blank" rel="noreferrer">
          {t("articles.open")}
        </a>
      </div>
    </li>
  );
}

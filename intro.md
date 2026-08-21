# Journal Watch — 技术与业务说明

个人用**呼吸道传染病流行病学**文献工作台。

## 正常逻辑（主线）

1. **`fetch:raw`** — 按启用刊拉取最新文的**原始条目**（题名、链接、DOI、摘要片段等）→ `data/raw/`。此步**不做主题搜索、不打相关度**。
2. **`screen:title`** — 用 AI 对原始条目做**关联度打分** → `data/candidates.json`。
3. **人工复核** — 在工作台 `/candidates` 上 keep / drop / 调分；人工结果与 AI 分一并写回候选池，形成**保留名单**。
4. **`fetch:detail`** — 只针对保留条目做**详情 enrichment**（中文摘要、要点等）→ `data/clean/articles.json`。**不再筛选**。实现上当前走 AI；也可改成规则/硬编码拼装字段。
5. **工作台展示** — `/` 读 clean 库展示优质文章；可再打 1–5 分写回 `ratings.json`。

筛选只发生在第 2–3 步；第 4 步是 enrichment。`pipeline` = 第 1+2 步，方便定时跑完后等人审，再手动跑第 4 步。

---

## 业务流水线

```
config/journals.yaml          prompts/*.md + index.json
        │                              │
        ▼                              ▼
   pnpm fetch:raw                 原始条目（题名等）
        │
        ▼
 data/raw/{journalId}_{ts}.json
        │
        ▼
 pnpm screen:title  ◄──────────── Gemini 关联度打分
        │
        ▼
 data/candidates.json  ──►  前端 /candidates（人工 keep/drop/调分）
        │                     更新保留条目
        ▼
 pnpm fetch:detail（仅保留名单；AI 或硬编码 enrichment）
        │
        ▼
 data/clean/articles.json  ──►  前端 /（优质文章工作台 + 1–5 评分）
        │
        ▼
 data/ratings.json（PAT 写回或本机草稿）
```

| 命令 | 作用 |
|------|------|
| `pnpm fetch:raw` | 拉原始条目 → `data/raw/`（别名 `crawl`） |
| `pnpm screen:title` | AI 关联度打分 → `data/candidates.json` |
| `pnpm fetch:detail` | 对保留条目 enrichment → `data/clean/`（非筛选） |
| `pnpm pipeline` | = fetch:raw + screen:title（**不含** detail） |
| `pnpm prune:raw` | 删超过 `RAW_RETENTION_MONTHS`（默认 3）的旧 raw |
| `pnpm screen` | 遗留一键详评（不推荐） |
| `pnpm sync:data` | 把 `data/`、`config/` 拷到 `web/public/` 供本地/Pages |

定时：`.github/workflows/crawl.yml`（每月 cron = `pipeline`；可选手动单步）。详情：`.github/workflows/fetch-detail.yml`（仅手动 **Fetch Detail**）。站点：`.github/workflows/pages.yml`（仅手动 Deploy）。

---

## 仓库结构（关键路径）

```
journal-watch/
├── config/journals.yaml          # 期刊全量列表；enabled 控制是否爬
├── prompts/
│   ├── index.json                # active.titleScreen / detailScreen
│   ├── screen-title.v1.md        # 标题初筛 prompt
│   └── screen-detail.v1.md       # 详评 prompt
├── data/
│   ├── raw/                      # 原始批次（可 prune）
│   ├── candidates.json           # 初筛候选 + 人工决策
│   ├── clean/articles.json       # 详评后主库
│   ├── ratings.json              # 人工 1–5 分
│   └── meta.json                 # 各刊爬取统计
├── packages/
│   ├── shared/                   # TS 契约（唯一数据形状来源）
│   └── pipeline/                 # Node 爬取 / 筛选 CLI
├── web/                          # React + Vite + i18n 工作台
├── scripts/sync-data.mjs         # data → web/public
└── .github/workflows/            # Journal Watch Jobs + fetch-detail + pages
```

---

## 包与调用逻辑

### `@journal-watch/shared`

[`packages/shared/src/types.ts`](packages/shared/src/types.ts) 定义统一契约，pipeline / web 共用。

核心类型：

| 类型 | 含义 |
|------|------|
| `JournalConfig` | 单刊配置（adapter / issn / feed / enabled） |
| `RawArticle` | 适配器产出的原始文 |
| `CandidateArticle` | 标题初筛结果 + `decision` / `humanScore` |
| `ScreenedArticle` | 详评后进入 clean 的文 |
| `ArticleRating` | 前端 1–5 评分 |
| `CrawlMeta` | 各刊 raw/kept 统计 |

### `@journal-watch/pipeline`

入口：[`packages/pipeline/src/cli.ts`](packages/pipeline/src/cli.ts) → 分发命令。

| 模块 | 职责 |
|------|------|
| `crawl.ts` | `fetch:raw`：读启用刊 → adapter → `writeRawBatch` → `meta.json` |
| `adapters/` | `rss` / `crossref` / `playwright`；统一返回 `RawArticle` |
| `screen-title.ts` | 合并最新 raw → 标题筛 → 写 `candidates.json`（保留人工字段） |
| `screen-detail.ts` | `fetch:detail`：短名单详评 → 写 `clean/articles.json` |
| `prune-raw.ts` | 按 mtime 删旧 raw 批次 |
| `ai/gemini.ts` | 读 active prompt；**必须** `GEMINI_API_KEY`，按稳定 id 去重不重复调 |
| `lib/paths.ts` | 仓库路径与 JSON 读写 |
| `lib/prompts.ts` | 解析 `prompts/index.json` + 加载对应 md |

**详评入选规则**（`selectForDetail`）：

- `decision === "drop"` → 排除  
- `decision === "keep"` → 必入  
- `decision === "pending"` 且 `(humanScore ?? aiScore) ≥ threshold` → 入  

阈值默认 `TITLE_KEEP_THRESHOLD` / `RELEVANCE_THRESHOLD`（0.45）。

### `@journal-watch/web`

| 路由 | 页 | 数据 |
|------|----|------|
| `/` | 最新文章 | `clean/articles.json` + `ratings.json` |
| `/candidates` | 候选复核 | `candidates.json`（keep/drop/调分） |
| `/journals` | 期刊配置一览 | `journals.yaml` + `meta.json` |
| `/settings` | PAT / 仓库 / 语言 | localStorage |

- 读：`web/src/lib/data.ts`（`BASE_URL` 下的静态 JSON）  
- 写评分 / 候选：有 PAT 则 GitHub Contents API 写回仓库；否则 localStorage 草稿 + 可下载 JSON  

本地预览前需 `pnpm sync:data`（或 `dev:web` 会先 sync）。

---

## 数据存储结构

### `data/raw/{journalId}_{iso}.json`

```json
{ "journalId": "nejm", "fetchedAt": "...", "articles": [ /* RawArticle[] */ ] }
```

同 `id` 多批次时，**后读文件覆盖**（`loadLatestRawArticles` 按文件名排序合并）。

`id` 优先为 `doi:{doi}`（小写规范化）；无 DOI 时为 `hash:…`。`fetchedAt` 只是本次抓取时间戳，**不参与** AI 去重。`screen:title` / `fetch:detail` 只要同 `id` 已处理过就跳过，只刷新元数据。

### `data/candidates.json`

```json
{
  "updatedAt": "...",
  "titlePromptId": "screen-title.v1",
  "threshold": 0.45,
  "candidates": [
    {
      "articleId": "...",
      "journalId": "vaccine",
      "title": "...",
      "aiScore": 0.72,
      "humanScore": null,
      "decision": "pending",
      "criteriaMatched": ["groupRelevant"],
      "summaryZh": "...",
      "reason": "...",
      "titlePromptId": "screen-title.v1",
      "screenedAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

`screen:title` 合并时**保留**已有 `decision` / `humanScore` / `note`。

### `data/clean/articles.json`

```json
{
  "updatedAt": "...",
  "articles": [ /* ScreenedArticle = RawArticle + relevanceScore / criteriaMatched / summaryZh / reason / screenedAt */ ]
}
```

### `data/ratings.json`

```json
{ "updatedAt": "...", "ratings": [{ "articleId", "score": 1-5, "note?", "updatedAt" }] }
```

### `data/meta.json`

各刊 `lastCrawlAt` / `rawCount` / `keptCount` / `error`；供期刊页展示。

---

## Prompt 机制

```
prompts/index.json  →  active.titleScreen / active.detailScreen
        ↓
  对应 *.md 全文作为系统说明 + 文题（详评再加摘要）拼进 Gemini
```

换版本：新增 `screen-title.v2.md`，改 `index.json` 的 `active` 即可，无需改代码。

---

## 配置与密钥

| 变量 | 用途 |
|------|------|
| `GEMINI_API_KEY` | AI 筛选（必填；缺失则报错退出） |
| `GEMINI_MODEL` | 默认 `gemini-3.1-flash-lite`（免费档日请求通常最宽） |
| `TITLE_BATCH_SIZE` | 标题初筛每请求篇数（默认 80；配额主要按请求次数计） |
| `GEMINI_DELAY_MS` | 批次间调 API 间隔 |
| `GEMINI_RETRIES` | 网络失败重试次数（默认 3） |
| `RELEVANCE_THRESHOLD` / `TITLE_KEEP_THRESHOLD` | 初筛入详评阈值 |
| `CROSSREF_MAILTO` | Crossref 礼貌池（非密钥） |
| `RAW_RETENTION_MONTHS` | raw 保留月数 |

期刊：只改 `config/journals.yaml` 的 `enabled` / `adapter`（`rss` 需 feed；`crossref` 需 issn；大刊常因 Cloudflare 默认 crossref）。

---

## 设计要点（业务）

1. **全量最新，不按主题搜** — Crossref 按 ISSN + 时间窗拉新文，避免关键词漏文。  
2. **初筛 + 人工 + 详评** — `screen:title` 批量初筛（默认 80 篇/次）→ 人调 keep/drop → `fetch:detail` 对短名单逐篇详评（enrich，不是再筛）。同一 DOI（`id`）各阶段只处理一次。标题 token 很少，免费档主要卡的是日请求次数（RPD），不是上下文长度。  
3. **个人仓库即数据库** — 无后端；JSON 进 git；评分/候选可用 PAT 写回。  
4. **契约单一** — 字段以 `packages/shared` 为准；前后端、CI 同形状。

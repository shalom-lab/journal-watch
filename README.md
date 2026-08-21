# Journal Watch

个人用呼吸道传染病流行病学文献雷达：抓取 → 标题初筛 → 人工复核 → 详评摘要 → GitHub Pages 展示 → 1–5 评分写回仓库。

## 功能

- `config/journals.yaml` 管理全量期刊（adapter / ISSN / RSS / enabled）
- 可复用适配器：`rss` · `crossref` · `playwright`（模板）
- 统一 TypeScript 接口（`@journal-watch/shared`）
- Prompt：`prompts/*.md` + `prompts/index.json`（可版本切换）
- 两段 AI：`screen:title` → 候选池；`screen:detail` → clean 摘要
- GitHub Actions 定时爬取 + 标题初筛（可选详评）
- React + Vite + i18n 工作台（文章 / 候选复核 / 期刊 / 设置）

## 快速开始

```bash
pnpm install
# 在项目根目录建 .env，写入 GEMINI_API_KEY=...
pnpm --filter @journal-watch/shared build
pnpm crawl
pnpm screen:title      # → data/candidates.json
# 在前端 /candidates 做 keep/drop，或直接：
pnpm screen:detail     # → data/clean/articles.json
pnpm sync:data
pnpm dev:web
```

`pnpm pipeline` = `crawl` + `screen:title`（不含详评，方便人工闸门）。

## 启用期刊

编辑 [`config/journals.yaml`](config/journals.yaml)，将目标期刊的 `enabled` 设为 `true`，并确认：

- `adapter: rss` → 需要 `feedUrl`
- `adapter: crossref` → 需要 `issn`
- `adapter: playwright` → 需要 `homepageUrl`

首期默认启用：NEJM、Lancet、JAMA、BMJ、Vaccine、Influenza and Other Respiratory Viruses。

## Prompt

```
prompts/
  index.json            # active.titleScreen / active.detailScreen
  screen-title.v1.md
  screen-detail.v1.md
```

改 prompt 时新建 `*.v2.md`，再改 `index.json` 的 `active` 即可。

## GitHub

1. 推送到 GitHub，Settings → Pages → Source = **GitHub Actions**
2. Secrets：`GEMINI_API_KEY`
3. 可选 Variables：`RELEVANCE_THRESHOLD`、`TITLE_KEEP_THRESHOLD`、`GEMINI_MODEL`、`TITLE_BATCH_SIZE`、`CROSSREF_MAILTO`、`RAW_RETENTION_MONTHS`
4. Actions：
   - **Journal Watch Jobs**：选 `pipeline` / `crawl` / `screen:title` / `prune:raw`（定时默认 `pipeline`）
   - **Screen Detail**：人工复核候选后，单独跑详评

### 评分 / 候选写回

在「设置」填入 fine-grained PAT（`contents: write`）及 `owner` / `repo`。

- 文章页评分 → `data/ratings.json`
- 候选页 keep/drop → `data/candidates.json`

无 PAT 时暂存 localStorage，并可下载 JSON 手动提交。

## 脚本

| 命令 | 作用 |
|------|------|
| `pnpm crawl` | 抓取原始条目 → `data/raw/` |
| `pnpm screen:title` | 标题初筛 → `data/candidates.json` |
| `pnpm screen:detail` | 对 keep / 高分候选详评 → `data/clean/` |
| `pnpm screen` | 遗留一键详评（不推荐） |
| `pnpm prune:raw` | 删除超过 `RAW_RETENTION_MONTHS` 的 raw 批次 |
| `pnpm pipeline` | crawl + screen:title |
| `pnpm dev:web` | 本地前端 |
| `pnpm sync:data` | 同步 data/config 到 `web/public` |

## 数据契约

见 [`packages/shared/src/types.ts`](packages/shared/src/types.ts)：`RawArticle` / `CandidateArticle` / `ScreenedArticle` / `ArticleRating` / `CrawlMeta`。

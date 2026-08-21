# Journal Watch

个人用呼吸道传染病流行病学文献工作台。

## 正常逻辑

1. **`fetch:raw`** — 拉取期刊最新文的原始条目（题名、链接、DOI 等）→ `data/raw/`
2. **`screen:title`** — AI 自动打关联度分 → `data/candidates.json`
3. **人工复核** — 工作台 `/candidates` keep / drop / 调分，更新保留名单
4. **`fetch:detail`** — 只对保留条目做详情 enrichment（当前 AI 摘要；也可硬编码规则）→ `data/clean/`
5. **工作台** — `/` 展示优质文章；可选 1–5 评分写回仓库

筛选只在第 2–3 步；第 4 步不再筛，只补详情。

## 功能

- `config/journals.yaml` 管理全量期刊（adapter / ISSN / RSS / enabled）
- 可复用适配器：`rss` · `crossref` · `playwright`（模板）
- 统一 TypeScript 接口（`@journal-watch/shared`）
- Prompt：`prompts/*.md` + `prompts/index.json`（可版本切换）
- GitHub Actions：一步一 workflow（`fetch:raw` / `screen:title` / `fetch:detail` / `prune:raw` / `deploy:pages`）；`pipeline` 编排 raw→title→prune
- React + Vite + i18n 工作台（文章 / 候选复核 / 期刊 / 设置）

## 快速开始

```bash
pnpm install
# 在项目根目录建 .env，写入 GEMINI_API_KEY=...
pnpm --filter @journal-watch/shared build
pnpm fetch:raw         # 原始条目
pnpm screen:title      # AI 关联度 → data/candidates.json
# 在前端 /candidates 做 keep/drop / 调分：
pnpm fetch:detail      # 保留条目 enrichment → data/clean/articles.json
pnpm sync:data
pnpm dev:web           # 工作台展示优质文章
```

`pnpm pipeline` = `fetch:raw` + `screen:title`（不含 detail，方便人工闸门）。

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
4. Actions（文件名连字符，显示名与 CLI 一致）：
   - **`pipeline`** — 定时/手动编排：`fetch:raw` → `screen:title` → `prune:raw`
   - **`fetch:raw`** / **`screen:title`** / **`prune:raw`** — 可单独手动跑
   - **`fetch:detail`** — 人工复核后 enrichment（不是再筛选）
   - **`deploy:pages`** — 刷新站点（不会随 push 自动部署）

### 评分 / 候选写回

在「设置」填入 fine-grained PAT（`contents: write`）及 `owner` / `repo`。

- 文章页评分 → `data/ratings.json`
- 候选页 keep/drop → `data/candidates.json`

无 PAT 时暂存 localStorage，并可下载 JSON 手动提交。

## 脚本

| 命令 | 作用 |
|------|------|
| `pnpm fetch:raw` | 拉原始条目 → `data/raw/`（别名 `pnpm crawl`） |
| `pnpm screen:title` | AI 关联度打分 → `data/candidates.json` |
| `pnpm fetch:detail` | 对保留条目 enrichment → `data/clean/`（非筛选） |
| `pnpm screen` | 遗留一键详评（不推荐） |
| `pnpm prune:raw` | 删除超过 `RAW_RETENTION_MONTHS` 的 raw 批次 |
| `pnpm pipeline` | fetch:raw + screen:title |
| `pnpm dev:web` | 本地前端 |
| `pnpm sync:data` | 同步 data/config 到 `web/public` |

## 数据契约

见 [`packages/shared/src/types.ts`](packages/shared/src/types.ts)：`RawArticle` / `CandidateArticle` / `ScreenedArticle` / `ArticleRating` / `CrawlMeta`。

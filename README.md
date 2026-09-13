# ai-digest

每日自动聚合 Reddit / Hacker News / arXiv / Google News 的 AI 热点，AI 生成中文日报与周报，静态站点展示。全链路零成本（GitHub Actions + Pages）。

## 数据流

```
cron 触发 Actions
  → scripts/fetch.mjs        抓 4 个源，标题哈希去重 → data/年/月/日.json
  → scripts/summarize.mjs    调 OpenAI 兼容 API → src/content/daily|weekly/年/…/*.md
  → commit 回仓库
  → Astro build → GitHub Pages 部署
```

AI 失败时自动降级为原始条目列表，流水线不会中断。每条要点同时生成独立详述页（`src/content/items/`，含原文链接与国内访问提示）。

## 内容安全规范

- 抓取时强制过滤敏感话题（关键词表在 `scripts/text.mjs` 的 `SENSITIVE_KEYWORDS`，可按需增删）

## 首次部署步骤

1. 推送到 GitHub 仓库，仓库 **Settings → Pages → Source 选 GitHub Actions**
2. **Settings → Secrets and variables → Actions** 添加 secret：
   - `AI_BASE_URL`：OpenAI 格式接口，如 `https://api.deepseek.com/v1`（不含 `/chat/completions`）
   - `AI_API_KEY`：对应 key
   - `AI_MODEL`：模型名，如 `deepseek-chat`（可选，默认 `gpt-4o-mini`）
   - `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`（可选但推荐）：Reddit 公开 JSON 接口会挡云 IP，去 https://www.reddit.com/prefs/apps 免费建一个 "script" 应用，填 id 和 secret 即可走 OAuth；不配置时回退公开接口
   - `SENSITIVE_KEYWORDS`（可选）：逗号或换行分隔的敏感词表，配置后**完全替代**内置默认表（见 `scripts/text.mjs`）；不配置则用内置默认表
3. 到 Actions 页手动跑一次「每日抓取与部署」（workflow_dispatch）验证
4. 部署到项目页（`username.github.io/ai-digest`）时，改 `astro.config.mjs` 里的 `site` 为 `https://<用户名>.github.io`，`base` 为仓库名

## 本地开发

```bash
npm install
npm run fetch           # 抓当天数据（无需 key）
AI_BASE_URL=... AI_API_KEY=... npm run summarize:daily   # 有 key 时生成 AI 日报 + 各要点详述页
npm run dev             # http://localhost:4321/ai-digest
```

`src/content/` 下的 `*-sample.md` 是合成样例数据，首次正式抓取后删除。

## 调整数据源

编辑 `scripts/fetch.mjs` 顶部的 `SUBREDDITS`（arXiv 分类、Google News 关键词在同文件对应函数里）。

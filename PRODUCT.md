# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro 5 静态站点（用户选择）。GitHub Actions 定时抓取 → AI 生成中文日/周报 MD → 提交进仓库 → GitHub Pages 自动部署。数据存储即 git 仓库本身。

## Users

中文技术圈读者（AI 从业者、研究者、爱好者）。工作日碎片时间浏览当天 AI 热点，周末阅读周报回顾全周趋势。桌面与移动端同权重。

## Product Purpose

每日自动聚合多平台 AI 热点话题（Reddit、Hacker News、arXiv、Google News），由 AI（OpenAI 兼容接口）生成中文「日报」与「周报」，以静态网站呈现。成功标准：无需人工干预，每天有新内容，摘要准确且可溯源。

## Positioning

跨平台聚合 + 中文 AI 摘要：同类英文 newsletter 不覆盖中文语境，手工整理的公众号无法每天稳定产出。机制是「开放 API 抓取 + LLM 编辑 + git 历史存档」。

## Operating Context

- 抓取与汇总完全由 GitHub Actions cron 驱动，产物 commit 回仓库
- AI 接口：OpenAI 格式，BASE_URL / API_KEY / MODEL 通过 Action secrets 配置
- 全链路使用免费额度：Actions、Pages、各数据源公开 API

## Capabilities and Constraints

- 默认数据源（已确认，不调整）：Reddit（r/MachineLearning、r/LocalLLaMA、r/singularity、r/OpenAI）、Hacker News（Algolia API）、arXiv（cs.AI/cs.CL/cs.LG 最新提交）、Google News RSS（AI / 人工智能，近 1 天）
- 日报：每天一份 MD；周报：每周日一份 MD，覆盖过去 7 天
- AI 失败时降级为原始条目列表，流水线不中断
- 去重：标题哈希，近 7 天已见条目不再重复收录

## Product Principles

- 当天数据当天可见，全自动，无人工编辑环节
- 每条摘要必须带原文链接，可溯源
- 日报看 breadth（各平台都覆盖），周报看 depth（趋势与主线）

## Evidence on Hand

暂无真实数据（抓取流水线首次运行后填充）。站内已有内容均为标明「示例」的合成样例，正式数据到位后删除。

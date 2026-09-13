#!/usr/bin/env node
// AI 汇总：node scripts/summarize.mjs daily|weekly
// 环境变量：AI_BASE_URL（OpenAI 格式，如 https://api.deepseek.com/v1，不含 /chat/completions）
//          AI_API_KEY、AI_MODEL（可选，默认 gpt-4o-mini）
// 每条要点同时生成独立详述页（src/content/items/），AI 不可用时降级为原始条目，流水线不中断。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSensitive, normalizeTaiwan, hash12 } from './text.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'daily';

// 与站点 base 保持一致（如部署到项目页 /ai-digest）
const cfgText = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
const SITE_BASE = (cfgText.match(/base:\s*['"]([^'"]*)['"]/)?.[1] ?? '').replace(/\/+$/, '');

const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
};

async function chat(system, user, { json = false } = {}) {
  const base = (process.env.AI_BASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.AI_API_KEY;
  if (!base || !key) throw new Error('未配置 AI_BASE_URL / AI_API_KEY');
  const body = {
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    ...(json && { response_format: { type: 'json_object' } }),
  };
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'x-opencode-session': randomUUID() },
    body: JSON.stringify(body),
  });
  if (!r.ok && json) {
    // 部分 OpenAI 兼容服务不支持 response_format，去掉重试一次
    delete body.response_format;
    const r2 = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'x-opencode-session': randomUUID() },
      body: JSON.stringify(body),
    });
    if (!r2.ok) throw new Error(`AI API ${r2.status}: ${(await r2.text()).slice(0, 300)}`);
    return (await r2.json()).choices[0].message.content.trim();
  }
  if (!r.ok) throw new Error(`AI API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).choices[0].message.content.trim();
}

const frontmatter = (fields) => {
  const esc = (v) => String(v).replace(/"/g, '\\"');
  const lines = Object.entries(fields).map(([k, v]) => (v == null || v === '' ? null : `${k}: "${esc(v)}"`)).filter(Boolean);
  return `---\n${lines.join('\n')}\n---\n\n`;
};

// data/ 与 content/daily/ 均为 年/月/日 层级目录
const dateDir = (base, date) => {
  const [y, m, d] = date.split('-');
  return { dir: join(base, y, m), file: d };
};

const fallbackList = (items) =>
  items
    .map((i, n) => `${n + 1}. **${normalizeTaiwan(i.title)}**（${i.source}${i.score ? `，热度 ${i.score}` : ''}）：[原文](${i.url})`)
    .join('\n\n');

const GUARD = '行文规范：全部使用中文，专有名词/模型名保留英文；涉及台湾必须表述为"中国台湾"；不得讨论或扩写中国政治相关敏感话题；不编造输入之外的信息。';

// ---------- 每条要点的详述页 ----------
async function generateDetails(refItems) {
  if (!refItems.length) return new Map();
  const list = refItems.map((i) => ({ source: i.source, title: normalizeTaiwan(i.title), url: i.url }));
  let parsed = null;
  try {
    const out = await chat(
      '你是中文科技编辑，为「AI 晨报」的每条热点撰写详述。' + GUARD + '\n' +
        '对每条输入生成 400-600 字中文详述，分 2-4 段：①背景与上下文（事件发生在什么脉络中）②核心内容（具体到数字、名称、对比）③影响与后续关注点。\n' +
        '输出 JSON 对象：{"details":[{"url":"输入中的url","summary":"详述正文"}]}，不要输出 JSON 以外的内容。',
      JSON.stringify(list),
      { json: true }
    );
    parsed = JSON.parse(out.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim());
  } catch (e) {
    console.error(`详述生成失败（详情页降级为原始条目）：${e.message}`);
  }
  const map = new Map();
  for (const d of parsed?.details ?? []) if (d?.url && d?.summary) map.set(d.url, d.summary);
  return map;
}

function writeItemPage(item, summary, date) {
  const title = normalizeTaiwan(item.title);
  const slug = hash12(item.url);
  const body =
    (summary ? `${summary}\n\n` : `（AI 详述未生成，以下为原始条目信息。${item.score ? `热度 ${item.score}。` : ''}）\n\n`) +
    `> 本页摘要由 AI 自动生成，仅供参考，请以原文为准。`;
  const md =
    frontmatter({ title, date, description: `${item.source} 的 AI 热点详述`, source: item.source, url: item.url, score: item.score == null ? undefined : Number(item.score) }) +
    body +
    '\n';
  const outPath = join(ROOT, 'src', 'content', 'items', `${slug}.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, md);
  return `${SITE_BASE}/items/${slug}/`;
}

// ---------- daily ----------
if (mode === 'daily') {
  // 可指定历史日期：node scripts/summarize.mjs daily 2026-08-15（用于回填）
  const date = process.argv[3] ?? new Date().toISOString().slice(0, 10);
  const { dir: dataDirD, file: dataFile } = dateDir(join(ROOT, 'data'), date);
  const dataPath = join(dataDirD, `${dataFile}.json`);
  if (!existsSync(dataPath)) {
    console.error(`没有 ${date} 的数据，先运行 scripts/fetch.mjs`);
    process.exit(1);
  }
  const safeItems = JSON.parse(readFileSync(dataPath, 'utf8')).items.filter((i) => !isSensitive(i.title));
  const feed = safeItems
    .map((i) => `- [${i.source}] ${normalizeTaiwan(i.title)}（赞 ${i.score} / 评 ${i.comments}）${i.url}`)
    .join('\n')
    .slice(0, 60000);

  let body = null;
  try {
    body = await chat(
      '你是一位中文科技编辑，为「AI 热点日报」撰写当天汇总。输出 Markdown 正文（不要用代码块包裹、不要另起 frontmatter），结构：\n' +
        '## 今日要点\n精选 8-12 条，必须是列表项，每条以 "- " 开头，格式：- **标题**（来源平台）：一句话中文摘要 [原文](URL)，链接 URL 必须来自输入条目，不要添加其他链接。\n' +
        '## 趋势观察\n2-3 段，指出今天值得关注的主线、信号。\n' +
        GUARD,
      feed
    );
  } catch (e) {
    console.error(`AI 汇总失败，降级为原始列表：${e.message}`);
  }
  if (!body) body = `## 今日要点\n\n${fallbackList(safeItems)}\n\n> 注：AI 服务不可用，以上为原始抓取条目。\n`;
  body = normalizeTaiwan(body);

  // 为每条要点生成详述页，并在正文中加"详情"内链
  const refUrls = [...body.matchAll(/\[原文\]\(([^)]+)\)/g)].map((m) => m[1]);
  const refItems = [...new Set(refUrls)].map((u) => safeItems.find((i) => i.url === u)).filter(Boolean);
  const details = await generateDetails(refItems);
  for (const it of refItems) writeItemPage(it, details.get(it.url), date);
  // 要点结构化：标题即链接（有详述页→详情，否则→原文），点击整个要点区域跳转
  body = body.replace(
    /^(?:[-*]\s+|\d+\.\s+|)\*\*(.+?)\*\*（(.+?)）：\s*(.+?)\s*\[原文\]\(([^)]+)\)\s*$/gm,
    (m, t, s, sum, u) => {
      const href = refItems.some((i) => i.url === u) ? `${SITE_BASE}/items/${hash12(u)}/` : u;
      return `- **[${t}](${href})**（${s}）\n\n  ${sum.trim().replace(/\s*·\s*$/, '')}`;
    }
  );

  const published = new Date().toLocaleTimeString('zh-CN', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const md = frontmatter({ title: `${date} AI 热点日报`, date, description: `Reddit / HN / arXiv / 新闻聚合的 ${date} AI 热点`, published });
  const [dy, dm, dd] = date.split('-');
  const outPath = join(ROOT, 'src', 'content', 'daily', dy, dm, `${dd}.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, md + body + '\n');
  console.log(`已生成 ${outPath}（含 ${refItems.length} 个详述页）`);
}

// ---------- weekly ----------
if (mode === 'weekly') {
  const now = new Date();
  const week = isoWeek(now);
  const days = [...Array(7)].map((_, i) => new Date(now - i * 864e5).toISOString().slice(0, 10));
  const materials = days
    .map((d) => {
      const mdPath = join(ROOT, 'src', 'content', 'daily', d.split('-').join('/'), `${d.split('-')[2]}.md`);
      if (existsSync(mdPath)) return `### ${d}\n${normalizeTaiwan(readFileSync(mdPath, 'utf8').split(/---\n/).slice(2).join('---'))}`;
      const { dir: dataDirD, file: dataFile } = dateDir(join(ROOT, 'data'), d);
      const dataPath = join(dataDirD, `${dataFile}.json`);
      if (existsSync(dataPath))
        return `### ${d}\n${fallbackList(JSON.parse(readFileSync(dataPath, 'utf8')).items.filter((i) => !isSensitive(i.title)).slice(0, 15))}`;
      return null;
    })
    .filter(Boolean)
    .join('\n\n');

  if (!materials) {
    console.error('过去 7 天没有任何数据，跳过周报');
    process.exit(1);
  }

  let body = null;
  try {
    body = await chat(
      '你是一位中文科技编辑，为「AI 热点周报」撰写本周汇总。材料是过去 7 天的日报内容。输出 Markdown 正文（不要用代码块包裹、不要另起 frontmatter），结构：\n' +
        '## 本周综述\n3-4 段，概括本周 AI 领域的主线事件与整体走向。\n' +
        '## 五大趋势\n5 条，每条一个小标题加 2-3 句展开，引用具体条目并附原文链接。\n' +
        '## 下周关注\n1 段，值得跟踪的动向。\n' +
        GUARD,
      materials.slice(0, 100000)
    );
  } catch (e) {
    console.error(`AI 周报失败，降级为日报汇编：${e.message}`);
  }
  if (!body) body = `## 本周日报汇编\n\n${materials}\n\n> 注：AI 服务不可用，以上为各日报原文汇编。\n`;
  body = normalizeTaiwan(body);

  const md = frontmatter({ title: `AI 热点周报 ${week}`, date: now.toISOString().slice(0, 10), description: `${week}（过去 7 天）AI 领域趋势汇总` });
  const [wy] = week.split('-');
  const outPath = join(ROOT, 'src', 'content', 'weekly', wy, `${week.split('-')[1]}.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, md + body + '\n');
  console.log(`已生成 ${outPath}`);
}

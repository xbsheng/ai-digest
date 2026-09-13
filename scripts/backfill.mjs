#!/usr/bin/env node
// 回填过去 N 天的日报数据：node scripts/backfill.mjs [days=30] [--summarize]
// 渠道限制：HN / arXiv 支持按日期回溯；Reddit / Google News 无历史接口，跳过。
// --summarize 需配置 AI_BASE_URL / AI_API_KEY，逐日生成日报 + 详述页（复用 summarize.mjs）。
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSensitive, normalizeTaiwan, hash12 } from './text.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'ai-digest/0.1 (+https://github.com; personal digest bot)';
const args = process.argv.slice(2);
const days = Math.min(90, parseInt(args[0]) || 30);
const doSummarize = args.includes('--summarize');
const refetchArxiv = args.includes('--arxiv'); // 对已写入但缺 arXiv 的天补抓

const json = (url) => fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.json());
const text = (url) => fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
const stripTags = (s) => s.replace(/<[^>]+>/g, '').trim();
const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const seenPath = join(ROOT, 'data', '_seen.json');
mkdirSync(join(ROOT, 'data'), { recursive: true });
const seen = new Set(existsSync(seenPath) ? JSON.parse(readFileSync(seenPath, 'utf8')) : []);

async function hnDay(start, end) {
  try {
    const d = await json(
      `https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=created_at_i>${start},created_at_i<${end}&hitsPerPage=100`
    );
    return d.hits
      .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
      .slice(0, 15)
      .map((h) => ({
        source: 'hackernews',
        title: h.title,
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        score: h.points ?? 0,
        comments: h.num_comments ?? 0,
        discuss: `https://news.ycombinator.com/item?id=${h.objectID}`,
      }));
  } catch (e) {
    console.error(`  hackernews: ${e.message}`);
    return [];
  }
}

async function arxivDay(date) {
  try {
    const ymd = date.replaceAll('-', '');
    const xml = await text(
      `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(
        `(cat:cs.AI OR cat:cs.CL OR cat:cs.LG) AND submittedDate:[${ymd}0000 TO ${ymd}2359]`
      )}&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
    );
    await sleep(3000); // arXiv 限速
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .map((m) => {
        const e = m[1];
        const title = decodeEntities(stripTags(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''));
        const id = e.match(/<id>(.*?)<\/id>/)?.[1] ?? '';
        return { source: 'arxiv', title, url: id, score: 0, comments: 0, discuss: id };
      })
      .filter((i) => i.title && i.url);
  } catch (e) {
    console.error(`  arxiv: ${e.message}`);
    return [];
  }
}

const dates = [...Array(days)].map((_, i) => new Date(Date.now() - (i + 1) * 864e5).toISOString().slice(0, 10));
let written = 0;
for (const date of dates) {
  const [y, m, d] = date.split('-');
  const outPath = join(ROOT, 'data', y, m, `${d}.json`);
  if (existsSync(outPath)) {
    if (refetchArxiv) {
      const cur = JSON.parse(readFileSync(outPath, 'utf8'));
      if (!cur.items.some((i) => i.source === 'arxiv')) {
        const a = await arxivDay(date);
        const fresh = a.filter((i) => {
          const k = hash12(i.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ''));
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (fresh.length) {
          cur.items.push(...fresh.map((i) => ({ ...i, title: normalizeTaiwan(i.title) })));
          writeFileSync(outPath, JSON.stringify(cur, null, 2));
          console.log(`${date} 补抓 arXiv → +${fresh.length} 条`);
        } else console.log(`${date} arXiv 无新增`);
      } else console.log(`${date} 已含 arXiv，跳过`);
    } else console.log(`${date} 已有数据，跳过`);
    continue;
  }
  const start = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  const end = Math.floor(Date.parse(`${date}T23:59:59Z`) / 1000) + 1;
  const [h, a] = await Promise.all([hnDay(start, end), arxivDay(date)]);
  const all = [...h, ...a].filter((i) => !isSensitive(i.title)).map((i) => ({ ...i, title: normalizeTaiwan(i.title) }));
  const items = all.filter((i) => {
    const k = hash12(i.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ''));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (items.length === 0) {
    console.log(`${date} 无条目，跳过`);
    continue;
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ date, fetchedAt: new Date().toISOString(), backfill: true, total: all.length, items }, null, 2));
  written++;
  console.log(`${date} → ${items.length} 条（HN ${h.length} / arXiv ${a.length}）`);
}

writeFileSync(seenPath, JSON.stringify([...seen].slice(-3000)));
console.log(`\n回填完成：${written}/${dates.length} 天数据已写入 data/`);

if (doSummarize) {
  if (!(process.env.AI_BASE_URL && process.env.AI_API_KEY)) {
    console.log('未配置 AI_BASE_URL / AI_API_KEY，跳过汇总。配置后运行：node scripts/backfill.mjs 30 --summarize');
  } else {
    for (const date of dates) {
      const [y, m, d] = date.split('-');
      if (!existsSync(join(ROOT, 'data', y, m, `${d}.json`))) continue;
      console.log(`\n=== 汇总 ${date} ===`);
      execSync(`node scripts/summarize.mjs daily ${date}`, { stdio: 'inherit', cwd: ROOT, env: process.env });
    }
  }
}

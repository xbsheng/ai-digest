#!/usr/bin/env node
// 每日抓取：Reddit + Hacker News + arXiv + Google News → data/YYYY-MM-DD.json
// 零依赖，Node 18+ 直接运行。
// ponytail: RSS/Atom 用正则解析（Google News / arXiv 结构固定），要接结构多变的源再换 fast-xml-parser
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSensitive, normalizeTaiwan, hash12 } from './text.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUBREDDITS = ['MachineLearning', 'LocalLLaMA', 'singularity', 'OpenAI'];
const UA = 'ai-digest/0.1 (+https://github.com; personal digest bot)';
const SEEN_CAP = 3000;

const json = (url) => fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.json());
const text = (url) => fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());
const stripTags = (s) => s.replace(/<[^>]+>/g, '').trim();
const normTitle = (t) => normalizeTaiwan(t).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
const hash = hash12;
const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function redditToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  const r = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'User-Agent': UA },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`reddit token ${r.status}`);
  return (await r.json()).access_token;
}

async function reddit() {
  const items = [];
  let token = null;
  try {
    token = await redditToken();
  } catch (e) {
    console.error(`reddit token: ${e.message}，回退公开接口`);
  }
  for (const sub of SUBREDDITS) {
    try {
      const headers = { 'User-Agent': UA, ...(token && { Authorization: `Bearer ${token}` }) };
      const r = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=15`, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      for (const { data: c } of d.data.children) {
        const external = typeof c.url_overridden_by_dest === 'string' && c.url_overridden_by_dest.startsWith('http');
        items.push({
          source: `reddit/r/${sub}`,
          title: c.title,
          url: external ? c.url_overridden_by_dest : `https://www.reddit.com${c.permalink}`,
          score: c.score ?? 0,
          comments: c.num_comments ?? 0,
          discuss: `https://www.reddit.com${c.permalink}`,
        });
      }
    } catch (e) {
      console.error(`reddit/r/${sub}: ${e.message}`);
    }
  }
  return items;
}
async function hackernews() {
  try {
    const since = Math.floor((Date.now() - 36 * 3600e3) / 1000);
    const d = await json(
      `https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=100`
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
    console.error(`hackernews: ${e.message}`);
    return [];
  }
}

async function arxiv() {
  try {
    const xml = await text(
      'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending'
    );
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .map((m) => {
        const e = m[1];
        const title = decodeEntities(stripTags(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''));
        const id = e.match(/<id>(.*?)<\/id>/)?.[1] ?? '';
        const authors = [...e.matchAll(/<name>(.*?)<\/name>/g)].map((a) => a[1]).slice(0, 3).join(', ');
        return { source: 'arxiv', title, url: id, score: 0, comments: 0, authors, discuss: id };
      })
      .filter((i) => i.title && i.url);
  } catch (e) {
    console.error(`arxiv: ${e.message}`);
    return [];
  }
}

async function googleNews() {
  try {
    const q = encodeURIComponent('AI OR 人工智能 when:1d');
    const xml = await text(`https://news.google.com/rss/search?q=${q}&hl=zh-CN&gl=CN&ceid=CN:zh`);
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, 15)
      .map((m) => {
        const e = m[1];
        const title = decodeEntities(stripTags(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''));
        const link = e.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
        return { source: 'google-news', title, url: link, score: 0, comments: 0, discuss: link };
      })
      .filter((i) => i.title && i.url);
  } catch (e) {
    console.error(`google-news: ${e.message}`);
    return [];
  }
}

// ---- main ----
const dataDir = join(ROOT, 'data');
mkdirSync(dataDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const seenPath = join(dataDir, '_seen.json');
const seen = new Set(existsSync(seenPath) ? JSON.parse(readFileSync(seenPath, 'utf8')) : []);

const [r, h, a, g] = await Promise.all([reddit(), hackernews(), arxiv(), googleNews()]);
const all = [...r, ...h, ...a, ...g]
  .filter((i) => !isSensitive(i.title))
  .map((i) => ({ ...i, title: normalizeTaiwan(i.title) }));

const items = all.filter((i) => {
  const h1 = hash(normTitle(i.title));
  if (seen.has(h1)) return false;
  seen.add(h1);
  return true;
});

let seenArr = [...seen];
if (seenArr.length > SEEN_CAP) seenArr = seenArr.slice(-SEEN_CAP);
writeFileSync(seenPath, JSON.stringify(seenArr));

const out = { date: today, fetchedAt: new Date().toISOString(), total: all.length, items };
const [y, m, d] = today.split('-');
const dayDir = join(dataDir, y, m);
mkdirSync(dayDir, { recursive: true });
writeFileSync(join(dayDir, `${d}.json`), JSON.stringify(out, null, 2));
console.log(`已保存 ${items.length}/${all.length} 条 → data/${y}/${m}/${d}.json（去重剔除 ${all.length - items.length} 条）`);

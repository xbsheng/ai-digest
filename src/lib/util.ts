export const withBase = (p: string) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}${p}`;

/** 日期 2026-09-13 → 层级路由 2026/09/13 */
export const datePath = (d: string) => d.split('-').join('/');

/** 报纸期号：自 2026-01-01 创刊日起算 */
export const issueOf = (date: string) =>
  Math.max(1, Math.floor((Date.parse(date + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 864e5) + 1);

export const fmtDate = (date: string) =>
  new Date(date + 'T00:00:00Z').toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  });

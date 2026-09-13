import { defineConfig } from 'astro/config';

// 外部链接一律新页签打开（MD 正文里的链接也统一处理）
function externalLinks() {
  return (tree) => {
    const visit = (node) => {
      if (node.tagName === 'a' && /^https?:/i.test(node.properties?.href ?? '')) {
        node.properties.target = '_blank';
        node.properties.rel = 'noopener noreferrer';
      }
      (node.children ?? []).forEach(visit);
    };
    visit(tree);
  };
}

// 部署到 GitHub 项目页 (username.github.io/ai-digest) 时需同时设置 site 和 base；
// 部署到自定义域名或 Vercel 时留空即可。
export default defineConfig({
  site: 'https://YOUR_USERNAME.github.io',
  base: '/ai-digest',
  markdown: { rehypePlugins: [externalLinks] },
});

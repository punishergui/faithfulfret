const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, 'public', 'manual', 'pages');
const OUT = path.join(ROOT, 'public', 'manual', 'search-index.json');

function walk(dir) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walk(full));
    else if (item.isFile() && item.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function slugFromFile(file) {
  return path.relative(PAGES_DIR, file).replace(/\\/g, '/').replace(/\.md$/, '');
}

function extractWikiLinks(md) {
  return [...md.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1].trim()).filter(Boolean);
}

function extractMdLinks(md) {
  const links = [];
  for (const m of md.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const href = (m[1] || '').trim();
    if (!href) continue;
    if (href.startsWith('#/manual/')) {
      links.push(href.replace(/^#\/manual\//, '').replace(/^\//, ''));
    }
  }
  return links;
}

function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/:::[\s\S]*?:::/g, ' ')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const files = walk(PAGES_DIR);
const docs = files.map(file => {
  const md = fs.readFileSync(file, 'utf8');
  const slug = slugFromFile(file);
  const title = (md.match(/^#\s+(.+)$/m) || [null, slug])[1].trim();
  const sections = [...md.matchAll(/^##\s+(.+)$/gm)].map(m => m[1].trim());
  const tags = [...new Set(slug.split('/').concat(sections.map(s => s.toLowerCase())))];
  const links = [...new Set(extractWikiLinks(md).concat(extractMdLinks(md)))];

  return {
    slug,
    title,
    text: stripMarkdown(md),
    links,
    tags,
    sections,
  };
});

const titleMap = new Map(docs.map(d => [d.title.toLowerCase(), d.slug]));
for (const d of docs) {
  d.links = [...new Set(d.links.map(link => titleMap.get(link.toLowerCase()) || link))];
}

const backlinks = {};
for (const d of docs) {
  for (const link of d.links) {
    if (!backlinks[link]) backlinks[link] = [];
    backlinks[link].push({ slug: d.slug, title: d.title });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  docs,
  backlinks,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Built manual index with ${docs.length} docs -> ${path.relative(ROOT, OUT)}`);

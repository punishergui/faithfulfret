const express = require('express');
const path = require('path');
const { execSync, exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const fsp = fs.promises;

const app = express();
const PORT = process.env.PORT || 9999;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function gitExec(cmd) {
  try {
    return execSync(cmd, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
}

function parseRepoOwnerRepo(remoteUrl) {
  if (!remoteUrl) return null;
  // Handle SSH: git@github.com:owner/repo.git
  let m = remoteUrl.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (m) return { owner: m[1], repo: m[2] };
  // Handle HTTPS: https://github.com/owner/repo.git
  m = remoteUrl.match(/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// GET /api/version
app.get('/api/version', async (req, res) => {
  const local = gitExec('git rev-parse HEAD');
  if (!local) {
    return res.json({ local: 'no-git', updateAvailable: false });
  }

  const remoteUrl = gitExec('git remote get-url origin');
  const parsed = parseRepoOwnerRepo(remoteUrl);
  if (!parsed) {
    return res.json({ local, updateAvailable: false });
  }

  const { owner, repo } = parsed;
  const repoUrl = `https://github.com/${owner}/${repo}`;

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/HEAD`;
    const data = await fetchJson(apiUrl, {
      'User-Agent': 'daily-fret',
      'Accept': 'application/vnd.github.v3+json'
    });
    const remote = data && data.sha ? data.sha : null;
    return res.json({
      local,
      remote: remote || local,
      updateAvailable: remote ? remote !== local : false,
      repoUrl
    });
  } catch (e) {
    return res.json({ local, remote: local, updateAvailable: false, repoUrl });
  }
});

// POST /api/update
app.post('/api/update', (req, res) => {
  try {
    const pullOut = execSync('git pull', { cwd: __dirname, encoding: 'utf8' });
    let npmOut = '';
    try {
      npmOut = execSync('npm install --production', { cwd: __dirname, encoding: 'utf8' });
    } catch (e) {
      npmOut = e.message;
    }
    res.json({ ok: true, output: pullOut + '\n' + npmOut });

    setTimeout(() => {
      exec('docker compose restart', { cwd: __dirname }, (err) => {
        if (err) {
          console.log('docker compose restart failed, exiting for restart policy:', err.message);
          process.exit(0);
        }
      });
    }, 500);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});



const LOCAL_PAGES_DIR = path.join(__dirname, 'public', 'manual', 'pages_local');
const LOCAL_ASSETS_DIR = path.join(__dirname, 'public', 'manual', 'assets_local');

function safeSlug(slug) {
  return String(slug || '').toLowerCase().replace(/[^a-z0-9-_/]/g, '').replace(/\.\./g, '');
}

async function ensureWikiDirs() {
  await fsp.mkdir(LOCAL_PAGES_DIR, { recursive: true });
  await fsp.mkdir(LOCAL_ASSETS_DIR, { recursive: true });
}

async function listLocalPages(dir = LOCAL_PAGES_DIR, prefix = '') {
  const out = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      const next = await listLocalPages(path.join(dir, e.name), `${prefix}${e.name}/`);
      out.push(...next);
      continue;
    }
    if (!e.name.endsWith('.md')) continue;
    const slug = `${prefix}${e.name.replace(/\.md$/, '')}`;
    const filePath = path.join(dir, e.name);
    const body = await fsp.readFile(filePath, 'utf8');
    const stat = await fsp.stat(filePath);
    out.push({ slug, title: slug.split('/').pop(), body, tags: [], sectionId: 'local-root', updatedAt: stat.mtimeMs, createdAt: stat.ctimeMs });
  }
  return out;
}

app.get('/api/wiki/pages', async (req, res) => {
  try {
    await ensureWikiDirs();
    const pages = await listLocalPages();
    res.json(pages);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/wiki/pages/:slug', async (req, res) => {
  try {
    await ensureWikiDirs();
    const slug = safeSlug(req.params.slug);
    const filePath = path.join(LOCAL_PAGES_DIR, `${slug}.md`);
    const body = await fsp.readFile(filePath, 'utf8');
    const stat = await fsp.stat(filePath);
    res.json({ slug, title: slug.split('/').pop(), body, tags: [], sectionId: 'local-root', updatedAt: stat.mtimeMs, createdAt: stat.ctimeMs });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

app.put('/api/wiki/pages/:slug', async (req, res) => {
  try {
    await ensureWikiDirs();
    const slug = safeSlug(req.params.slug);
    const filePath = path.join(LOCAL_PAGES_DIR, `${slug}.md`);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, String(req.body.body || ''), 'utf8');
    res.json({ ok: true, slug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/wiki/pages/:slug', async (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const filePath = path.join(LOCAL_PAGES_DIR, `${slug}.md`);
    await fsp.unlink(filePath);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/wiki/assets', async (req, res) => {
  try {
    await ensureWikiDirs();
    const filename = safeSlug((req.body.filename || 'image').replace(/\//g, '-'));
    const ext = (filename.split('.').pop() || 'png').toLowerCase();
    const finalName = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    const filePath = path.join(LOCAL_ASSETS_DIR, finalName);
    const b64 = String(req.body.base64 || '');
    await fsp.writeFile(filePath, Buffer.from(b64, 'base64'));
    res.json({ ok: true, path: `/manual/assets_local/${finalName}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback — return index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Daily Fret running on port ${PORT}`);
});

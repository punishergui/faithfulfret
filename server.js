const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const https = require('https');
const Store = require('./data-store');

const app = express();
const apiRouter = express.Router();
const PORT = process.env.PORT || 9999;
const presetMediaDir = '/data/presets';
if (!fs.existsSync(presetMediaDir)) fs.mkdirSync(presetMediaDir, { recursive: true });

app.use(express.json({ limit: '20mb' }));

function gitExec(cmd) {
  try {
    return execSync(cmd, { cwd: __dirname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
}

function shellEscapeRef(ref) {
  return String(ref || '').replace(/[^a-zA-Z0-9_\-/.]/g, '');
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

function buildStats() {
  const sessions = Store.listSessions();
  const count = sessions.length;
  const totalMinutes = sessions.reduce((sum, row) => sum + (Number(row.durationMinutes) || 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const bpms = sessions.map((row) => Number(row.bpm) || 0).filter(Boolean);
  const maxBPM = bpms.length ? Math.max(...bpms) : 0;
  const avgBPM = bpms.length ? Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length) : 0;

  const allDates = sessions.map((row) => row.date).filter(Boolean).sort().reverse();
  const uniqueDatesDesc = [...new Set(allDates)];
  const uniqueDatesAsc = [...uniqueDatesDesc].reverse();
  const toDate = (ymd) => new Date(`${ymd}T12:00:00`);
  const dayDiff = (a, b) => Math.round((toDate(a) - toDate(b)) / 86400000);
  const today = new Date().toISOString().split('T')[0];

  let currentStreak = 0;
  if (uniqueDatesDesc.length) {
    const offset = dayDiff(today, uniqueDatesDesc[0]);
    if (offset === 0 || offset === 1) {
      currentStreak = 1;
      for (let i = 1; i < uniqueDatesDesc.length; i += 1) {
        if (dayDiff(uniqueDatesDesc[i - 1], uniqueDatesDesc[i]) === 1) currentStreak += 1;
        else break;
      }
    }
  }

  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < uniqueDatesAsc.length; i += 1) {
    if (i === 0) run = 1;
    else if (dayDiff(uniqueDatesAsc[i], uniqueDatesAsc[i - 1]) === 1) run += 1;
    else run = 1;
    if (run > longestStreak) longestStreak = run;
  }

  const lastSessionDate = uniqueDatesDesc[0] || null;
  const daysSinceLastSession = lastSessionDate ? Math.max(0, dayDiff(today, lastSessionDate)) : null;
  const weeksTracked = new Set(uniqueDatesDesc.map((d) => `${d.slice(0, 4)}-${d.slice(5, 7)}-${Math.ceil(Number(d.slice(8, 10)) / 7)}`)).size;
  const sessionsPerWeek = count ? Math.round((count / Math.max(1, weeksTracked)) * 10) / 10 : 0;

  return {
    count,
    totalMinutes,
    totalHours,
    maxBPM,
    avgBPM,
    streak: currentStreak,
    currentStreak,
    longestStreak,
    lastSessionDate,
    daysSinceLastSession,
    allDates,
    sessionsPerWeek,
  };
}

// Data API
apiRouter.get('/health', (req, res) => {
  res.json({ ok: true, db: Store.dbPath });
});

apiRouter.get('/stats', (req, res) => {
  res.json(buildStats());
});

apiRouter.get('/sessions', (req, res) => {
  const sessions = Store.listSessions();
  const gearRows = Store.listSessionGearBySessionIds(sessions.map((row) => row.id));
  const bySession = {};
  gearRows.forEach((row) => {
    if (!bySession[row.sessionId]) bySession[row.sessionId] = [];
    bySession[row.sessionId].push({ id: row.id, name: row.name, category: row.category, status: row.status });
  });
  res.json(sessions.map((row) => ({ ...row, gear: bySession[row.id] || [] })));
});
apiRouter.get('/session-heatmap', (req, res) => res.json(Store.listSessionDailyTotals()));
apiRouter.post('/sessions', (req, res) => {
  if (!req.body?.date) return res.status(400).json({ error: 'date is required' });
  return res.json(Store.saveSession(req.body));
});
apiRouter.get('/sessions/:id', (req, res) => {
  const row = Store.getSession(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...row, gear: Store.listSessionGear(req.params.id) });
});
apiRouter.put('/sessions/:id', (req, res) => {
  const saved = Store.saveSession({ ...req.body, id: req.params.id });
  res.json(saved);
});
apiRouter.delete('/sessions/:id', (req, res) => {
  Store.deleteSession(req.params.id);
  res.json({ ok: true });
});

function sendGearItems(req, res) {
  const includeLinks = req.query.includeLinks !== 'false';
  res.json(Store.listGear(includeLinks));
}

apiRouter.get('/gear-items', sendGearItems);
apiRouter.get('/gear', sendGearItems);
apiRouter.post('/gear-items', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'name is required' });
  return res.json(Store.saveGear(req.body));
});
apiRouter.get('/gear-items/:id', (req, res) => {
  const row = Store.getGear(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...row, linksList: Store.getGearLinks(req.params.id) });
});
apiRouter.put('/gear-items/:id', (req, res) => res.json(Store.saveGear({ ...req.body, id: req.params.id })));
apiRouter.delete('/gear-items/:id', (req, res) => {
  Store.deleteGear(req.params.id);
  res.json({ ok: true });
});

apiRouter.get('/gear-items/:id/links', (req, res) => res.json(Store.getGearLinks(req.params.id)));
apiRouter.post('/gear-items/:id/links', (req, res) => {
  if (!req.body?.url) return res.status(400).json({ error: 'url is required' });
  return res.json(Store.saveGearLink({ ...req.body, gearId: req.params.id }));
});
apiRouter.put('/gear-items/:id/links/:linkId', (req, res) => {
  const links = Store.getGearLinks(req.params.id);
  const existing = links.find((row) => row.id === req.params.linkId);
  if (!existing) return res.status(404).json({ error: 'not found' });
  return res.json(Store.saveGearLink({ ...existing, ...req.body, id: req.params.linkId, gearId: req.params.id }));
});
apiRouter.delete('/gear-items/:id/links/:linkId', (req, res) => {
  Store.deleteGearLink(req.params.linkId);
  res.json({ ok: true });
});

apiRouter.put('/sessions/:id/gear', (req, res) => {
  const gearIds = Array.isArray(req.body?.gearIds) ? req.body.gearIds : [];
  res.json(Store.saveSessionGear(req.params.id, gearIds));
});
apiRouter.get('/sessions/:id/gear', (req, res) => res.json(Store.listSessionGear(req.params.id)));
apiRouter.get('/gear-usage', (req, res) => res.json(Store.getGearUsage()));
apiRouter.get('/gear/usage', (req, res) => res.json(Store.getGearUsage()));

apiRouter.get('/presets', (req, res) => res.json(Store.listPresets()));
apiRouter.post('/presets', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'name is required' });
  res.json(Store.savePreset(req.body));
});
apiRouter.get('/presets/:id', (req, res) => {
  const row = Store.getPreset(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});
apiRouter.put('/presets/:id', (req, res) => res.json(Store.savePreset({ ...req.body, id: req.params.id })));
apiRouter.delete('/presets/:id', (req, res) => {
  Store.deletePreset(req.params.id);
  res.json({ ok: true });
});

function sanitizeFileName(name) {
  return String(name || 'preset-image')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'preset-image';
}

function extensionFromMime(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[String(mimeType || '').toLowerCase()] || 'jpg';
}

function savePresetImageFromBuffer({ fileName, mimeType, buffer }) {
  const ext = extensionFromMime(mimeType);
  const safeBase = sanitizeFileName(fileName).replace(/\.[^/.]+$/, '');
  const finalName = `${Date.now()}-${safeBase}.${ext}`;
  const fullPath = path.join(presetMediaDir, finalName);
  fs.writeFileSync(fullPath, buffer);
  return { filePath: `/media/presets/${finalName}` };
}

function parseMultipartImage(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
    if (!boundaryMatch) return reject(new Error('multipart boundary missing'));
    const boundary = `--${boundaryMatch[1]}`;
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const bodyStr = body.toString('binary');
        const start = bodyStr.indexOf(boundary);
        if (start < 0) throw new Error('multipart body missing boundary');
        const fileNameMatch = bodyStr.match(/filename="([^"]+)"/i);
        const mimeMatch = bodyStr.match(/Content-Type:\s*([^\r\n]+)/i);
        const headerEnd = bodyStr.indexOf('\r\n\r\n');
        if (headerEnd < 0) throw new Error('multipart file header invalid');
        const dataStart = headerEnd + 4;
        const dataEnd = bodyStr.lastIndexOf(`\r\n${boundary}--`);
        if (dataEnd < 0) throw new Error('multipart file data invalid');
        const fileBinary = bodyStr.slice(dataStart, dataEnd);
        resolve({
          fileName: fileNameMatch ? fileNameMatch[1] : 'preset-image',
          mimeType: mimeMatch ? mimeMatch[1].trim() : 'image/jpeg',
          buffer: Buffer.from(fileBinary, 'binary'),
        });
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

apiRouter.post('/preset-image', async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
      const image = await parseMultipartImage(req);
      return res.json(savePresetImageFromBuffer(image));
    }

    const fileName = req.body?.fileName || 'preset-image';
    const mimeType = req.body?.mimeType || 'image/jpeg';
    let dataBase64 = req.body?.dataBase64 || '';

    if (typeof dataBase64 === 'string' && dataBase64.startsWith('data:')) {
      const parts = dataBase64.split(',');
      if (parts.length === 2) dataBase64 = parts[1];
    }

    if (!dataBase64) return res.status(400).json({ error: 'image data is required' });

    const buffer = Buffer.from(dataBase64, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'invalid image payload' });

    return res.json(savePresetImageFromBuffer({ fileName, mimeType, buffer }));
  } catch (e) {
    return res.status(400).json({ error: e.message || 'failed to save preset image' });
  }
});

// Keep existing resources features
apiRouter.get('/resources', (req, res) => res.json(Store.listResources()));
apiRouter.post('/resources', (req, res) => res.json(Store.saveResource(req.body || {})));
apiRouter.get('/resources/:id', (req, res) => {
  const row = Store.getResource(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});
apiRouter.put('/resources/:id', (req, res) => res.json(Store.saveResource({ ...req.body, id: req.params.id })));
apiRouter.delete('/resources/:id', (req, res) => {
  Store.deleteResource(req.params.id);
  res.json({ ok: true });
});

apiRouter.get('/export', (req, res) => {
  res.json({
    sessions: Store.listSessions(),
    gear: Store.listGear(false),
    gear_links: Store.listGear().flatMap((item) => (item.linksList || []).map((link) => ({ ...link, isPrimary: Number(link.isPrimary) ? 1 : 0 }))),
    session_gear: Store.listSessions().flatMap((session) => Store.listSessionGear(session.id).map((gear) => ({ sessionId: session.id, gearId: gear.id }))),
    resources: Store.listResources(),
    presets: Store.listPresets(),
    exportedAt: new Date().toISOString(),
  });
});

apiRouter.post('/import', (req, res) => {
  const payload = req.body || {};
  Store.clearAll();
  for (const row of (payload.sessions || [])) Store.saveSession(row);
  for (const row of (payload.gear || [])) {
    const saved = Store.saveGear(row);
    if (Array.isArray(row.linksList) && row.linksList.length) {
      Store.replaceGearLinks(saved.id, row.linksList);
    }
  }
  for (const row of (payload.gear_links || [])) Store.saveGearLink({ ...row, isPrimary: Number(row?.isPrimary) ? 1 : 0 });
  const sessionGear = payload.session_gear || payload.sessionGear || [];
  const grouped = {};
  sessionGear.forEach((row) => {
    if (!row?.sessionId || !row?.gearId) return;
    if (!grouped[row.sessionId]) grouped[row.sessionId] = [];
    grouped[row.sessionId].push(row.gearId);
  });
  Object.entries(grouped).forEach(([sessionId, gearIds]) => Store.saveSessionGear(sessionId, gearIds));
  for (const row of (payload.resources || [])) Store.saveResource(row);
  for (const row of (payload.presets || [])) Store.savePreset(row);
  res.json({ ok: true });
});

// GET /api/version
apiRouter.get('/version', async (req, res) => {
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


apiRouter.get('/update/help', (req, res) => {
  const currentBranch = gitExec('git rev-parse --abbrev-ref HEAD') || 'main';
  const remote = gitExec(`git config branch.${currentBranch}.remote`) || 'origin';
  const mergeRef = gitExec(`git config branch.${currentBranch}.merge`) || `refs/heads/${currentBranch}`;
  const remoteBranch = mergeRef.replace('refs/heads/', '');

  const commands = [
    `cd ${__dirname}`,
    '# optional safety backup before force-sync',
    `git branch backup-before-sync-$(date +%Y%m%d-%H%M%S)`,
    `git fetch ${remote} ${remoteBranch}`,
    `git reset --hard ${remote}/${remoteBranch}`,
    'npm install --production',
    'npm run build:manual',
    'docker compose restart',
    'Hard refresh browser (Ctrl+Shift+R)',
    '# PR conflict auto-merge helper (replace branch if needed)',
    `./scripts/auto-merge-update.sh ${currentBranch}`,
  ];

  res.json({
    branch: currentBranch,
    remote,
    remoteBranch,
    mode: 'force-sync',
    summary: 'One-click sync discards local repo edits and fast-forwards to remote branch.',
    commands,
  });
});

// POST /api/update
apiRouter.post('/update', (req, res) => {
  try {
    const currentBranch = gitExec('git rev-parse --abbrev-ref HEAD') || 'main';
    const remote = gitExec(`git config branch.${currentBranch}.remote`) || 'origin';
    const mergeRef = gitExec(`git config branch.${currentBranch}.merge`) || `refs/heads/${currentBranch}`;
    const remoteBranch = mergeRef.replace('refs/heads/', '');

    const safeBranch = shellEscapeRef(currentBranch);
    const safeRemote = shellEscapeRef(remote);
    const safeRemoteBranch = shellEscapeRef(remoteBranch);

    const beforeHead = gitExec('git rev-parse --short HEAD') || 'unknown';
    const isDirty = (gitExec('git status --porcelain') || '').trim().length > 0;
    const backupBranch = `backup-auto-sync-${Date.now()}`;

    const backupOut = execSync(`git branch ${backupBranch} ${safeBranch}`, { cwd: __dirname, encoding: 'utf8' });
    const fetchOut = execSync(`git fetch ${safeRemote} ${safeRemoteBranch}`, { cwd: __dirname, encoding: 'utf8' });
    const hardResetOut = execSync(`git reset --hard ${safeRemote}/${safeRemoteBranch}`, { cwd: __dirname, encoding: 'utf8' });

    let npmOut = '';
    try {
      npmOut = execSync('npm install --production', { cwd: __dirname, encoding: 'utf8' });
    } catch (e) {
      npmOut = e.message;
    }

    let manualOut = '';
    try {
      manualOut = execSync('npm run build:manual', { cwd: __dirname, encoding: 'utf8' });
    } catch (e) {
      manualOut = e.message;
    }

    const syncSummary = [
      `Auto conflict resolution: enabled (force-sync).`,
      `Previous HEAD: ${beforeHead}`,
      `Working tree dirty before sync: ${isDirty ? 'yes' : 'no'}`,
      `Backup branch created: ${backupBranch}`,
      `Now tracking: ${safeRemote}/${safeRemoteBranch}`,
    ].join('\n');

    res.json({ ok: true, output: [syncSummary, backupOut, fetchOut, hardResetOut, npmOut, manualOut].join('\n') });

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

app.use('/api', apiRouter);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use('/media/presets', express.static(presetMediaDir));
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — return index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Daily Fret running on port ${PORT}`);
});

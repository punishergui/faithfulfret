const express = require('express');
const path = require('path');
const { execSync, exec } = require('child_process');
const https = require('https');

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


app.get('/api/update/help', (req, res) => {
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
app.post('/api/update', (req, res) => {
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



// SPA fallback — return index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Daily Fret running on port ${PORT}`);
});

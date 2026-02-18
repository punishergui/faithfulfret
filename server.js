const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, exec, spawn } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const JSZip = require('jszip');
const multer = require('multer');
const Store = require('./data-store');
const { generateVideoThumbnail } = require('./server/thumbs');

const app = express();
const apiRouter = express.Router();
const PORT = process.env.PORT || 9999;
const presetMediaDir = '/data/presets';
const gearMediaDir = '/data/gear';
const uploadsDir = '/data/uploads';
const trainingVideosDir = '/data/uploads/videos';
const trainingThumbsDir = '/data/uploads/thumbnails';
const presetAudioDir = '/data/uploads/preset-audio';
const trainingUploadMaxMb = Number(process.env.TRAINING_UPLOAD_MAX_MB ?? 2048);
const trainingUploadMaxBytes = Number.isFinite(trainingUploadMaxMb) && trainingUploadMaxMb > 0 ? Math.floor(trainingUploadMaxMb * 1024 * 1024) : 0;
if (!fs.existsSync(presetMediaDir)) fs.mkdirSync(presetMediaDir, { recursive: true });
if (!fs.existsSync(gearMediaDir)) fs.mkdirSync(gearMediaDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(trainingVideosDir)) fs.mkdirSync(trainingVideosDir, { recursive: true });
if (!fs.existsSync(trainingThumbsDir)) fs.mkdirSync(trainingThumbsDir, { recursive: true });
if (!fs.existsSync(presetAudioDir)) fs.mkdirSync(presetAudioDir, { recursive: true });
const restoreBackupDir = '/data/_restore_backup';
if (!fs.existsSync(restoreBackupDir)) fs.mkdirSync(restoreBackupDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });
const trainingVideoUpload = multer({
  storage: multer.memoryStorage(),
  ...(trainingUploadMaxBytes > 0 ? { limits: { fileSize: trainingUploadMaxBytes } } : {}),
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('unsupported file type'));
    cb(null, true);
  },
});
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) return cb(new Error('unsupported file type'));
    cb(null, true);
  },
});
let isMaintenanceMode = false;

app.use(express.json({ limit: '20mb' }));
app.use('/api', (req, res, next) => {
  if (!isMaintenanceMode) return next();
  if (req.path === '/health') return next();
  return res.status(503).json({ error: 'maintenance mode: restore in progress' });
});

function buildJsonExport(localSettings = {}) {
  const tables = typeof Store.exportAllTables === 'function' ? Store.exportAllTables() : {};
  return {
    schemaVersion: 3,
    createdAt: new Date().toISOString(),
    tables,
    localSettings: localSettings && typeof localSettings === 'object' ? localSettings : {},
    // legacy keys for compatibility
    sessions: tables.sessions || Store.listSessions(),
    gear: tables.gear_items || Store.listGear(false),
    gear_links: tables.gear_links || [],
    gear_images: tables.gear_images || [],
    session_gear: tables.session_gear || [],
    resources: tables.resources || Store.listResources(),
    presets: tables.presets || Store.listPresets(),
  };
}

function countExportEntities(payload) {
  const tables = payload?.tables || {};
  const count = (name, fallback) => Array.isArray(tables[name]) ? tables[name].length : (Array.isArray(fallback) ? fallback.length : 0);
  return {
    sessions: count('sessions', payload.sessions),
    gear_items: count('gear_items', payload.gear),
    gear_links: count('gear_links', payload.gear_links),
    gear_images: count('gear_images', payload.gear_images),
    session_gear: count('session_gear', payload.session_gear),
    resources: count('resources', payload.resources),
    presets: count('presets', payload.presets),
    tables: Object.keys(tables).length,
  };
}

function withExportMeta(payload) {
  const schemaVersion = Number(payload?.schemaVersion) || 3;
  const createdAt = payload?.createdAt || payload?.exportedAt || new Date().toISOString();
  return { ...payload, schemaVersion, createdAt, exportedAt: createdAt, counts: countExportEntities(payload) };
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid import payload');
  if (payload.tables != null && (typeof payload.tables !== 'object' || Array.isArray(payload.tables))) throw new Error('invalid tables payload');
}

function normalizeLegacyTables(payload) {
  if (payload.tables && typeof payload.tables === 'object') return payload.tables;
  return {
    sessions: Array.isArray(payload.sessions) ? payload.sessions : [],
    gear_items: Array.isArray(payload.gear) ? payload.gear : [],
    gear_links: Array.isArray(payload.gear_links) ? payload.gear_links : [],
    gear_images: Array.isArray(payload.gear_images) ? payload.gear_images : [],
    session_gear: Array.isArray(payload.session_gear || payload.sessionGear) ? (payload.session_gear || payload.sessionGear) : [],
    resources: Array.isArray(payload.resources) ? payload.resources : [],
    presets: Array.isArray(payload.presets) ? payload.presets : [],
  };
}

function restoreFromPayload(payload) {
  validateImportPayload(payload);
  if (typeof Store.ensureSchema === 'function') Store.ensureSchema();
  const tables = normalizeLegacyTables(payload);
  if (typeof Store.importAllTables === 'function') {
    Store.importAllTables(tables);
  } else {
    Store.clearAll();
    for (const row of (tables.sessions || [])) Store.saveSession(row);
    for (const row of (tables.gear_items || [])) Store.saveGear(row);
    for (const row of (tables.gear_links || [])) Store.saveGearLink({ ...row, isPrimary: Number(row?.isPrimary) ? 1 : 0 });
    for (const row of (tables.gear_images || [])) {
      if (row?.gearId && row?.filePath) Store.addGearImage({ gearId: row.gearId, filePath: row.filePath, sortOrder: row.sortOrder || 0 });
    }
    const grouped = {};
    (tables.session_gear || []).forEach((row) => {
      if (!row?.sessionId || !row?.gearId) return;
      if (!grouped[row.sessionId]) grouped[row.sessionId] = [];
      grouped[row.sessionId].push(row.gearId);
    });
    Object.entries(grouped).forEach(([sessionId, gearIds]) => Store.saveSessionGear(sessionId, gearIds));
    for (const row of (tables.resources || [])) Store.saveResource(row);
    for (const row of (tables.presets || [])) Store.savePreset(row);
  }
  return countExportEntities({ ...payload, tables });
}

function copyTreeIntoZip(zip, basePath, zipPath) {
  if (!fs.existsSync(basePath)) return;
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  entries.forEach((entry) => {
    const abs = path.join(basePath, entry.name);
    const rel = `${zipPath}/${entry.name}`;
    if (entry.isDirectory()) {
      copyTreeIntoZip(zip, abs, rel);
      return;
    }
    zip.file(rel, fs.readFileSync(abs));
  });
}

function copyTreeFromTemp(sourceDir, targetDir, replace = true) {
  if (!fs.existsSync(sourceDir)) return;
  if (replace && fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  entries.forEach((entry) => {
    const src = path.join(sourceDir, entry.name);
    const dst = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyTreeFromTemp(src, dst, false);
      return;
    }
    fs.copyFileSync(src, dst);
  });
}

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



function sanitizeUploadFileName(name = '') {
  return String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getVideoIdFromUrl(value) {
  return extractYouTubeId(value);
}



function resolveTrainingThumb(video = {}) {
  return video.thumbnail_url || video.thumb_url || video.thumbUrl || '';
}

function resolveTrainingWatchUrl(video = {}) {
  if (video.source_type === 'upload' && video.upload_url) return video.upload_url;
  return video.youtube_url || video.url || '';
}

function filePathFromUploadUrl(url, expectedDir) {
  if (!url || typeof url !== 'string' || !url.startsWith('/uploads/')) return null;
  const relative = url.slice('/uploads/'.length);
  const fullPath = path.join(uploadsDir, relative);
  if (!fullPath.startsWith(expectedDir)) return null;
  return fullPath;
}

function safeUnlink(fullPath) {
  if (!fullPath) return;
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (error) {
    console.warn('[training] failed to delete file', fullPath, error.message || error);
  }
}

function hasFfmpeg() {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-version']);
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}

function normalizeTrainingVideo(row = {}) {
  const thumb = resolveTrainingThumb(row);
  const hasLocalVideo = Boolean(row.local_video_path || row.upload_url);
  return {
    ...row,
    hasLocalVideo,
    thumbUrl: thumb,
    thumb_url: thumb,
    thumbnail_url: thumb,
    watch_url: resolveTrainingWatchUrl(row),
  };
}

async function buildLocalVideoThumbnail(video = {}) {
  const videoPath = video.local_video_path || filePathFromUploadUrl(video.upload_url, trainingVideosDir);
  if (!videoPath) return { ok: false, error: 'local video path is not set' };
  const thumbName = `${Number(video.id)}.jpg`;
  const thumbPath = path.join(trainingThumbsDir, thumbName);
  const thumbUrl = `/uploads/thumbnails/${thumbName}`;
  const result = await generateVideoThumbnail({ inputPath: videoPath, outputPath: thumbPath, outputUrl: thumbUrl, seekSeconds: 2 });
  if (!result.ok) return result;
  Store.saveTrainingVideoThumbnail(video.id, { thumbnail_path: thumbPath, thumbnail_url: thumbUrl });
  return { ...result, thumbnailUrl: thumbUrl, thumbnail_path: thumbPath };
}

function extractYouTubeId(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.replace('www.', '');
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
    }
    if (host.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      const maybe = parts[1] || parts[0] || '';
      return /^[a-zA-Z0-9_-]{11}$/.test(maybe) ? maybe : '';
    }
  } catch {
    return '';
  }
  return '';
}

function playlistWithItems(id) {
  const playlist = Store.getVideoPlaylist(id);
  if (!playlist) return null;
  const items = Store.listPlaylistItems(id);
  const enriched = items.map((item) => {
    const videoId = Number(item.video_id || item.videoId);
    const video = videoId ? Store.getTrainingVideo(videoId) : null;
    const progress = videoId ? Store.getTrainingVideoProgress(videoId) : null;
    return {
      ...item,
      video,
      progress,
    };
  });
  return { ...playlist, items: enriched };
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

apiRouter.get('/db-info', (req, res) => {
  res.json(Store.getDbInfo());
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
  if (!req.body?.date) {
    const session = Store.createDraftSession(req.body || {});
    return res.status(201).json({ id: session.id, ...session });
  }
  return res.json(Store.saveSession(req.body));
});
apiRouter.get('/sessions/:id', (req, res) => {
  const row = Store.getSessionWithItems(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...row, gear: Store.listSessionGear(req.params.id) });
});
apiRouter.put('/sessions/:id', (req, res) => {
  const saved = Store.saveSession({ ...req.body, id: req.params.id });
  res.json(saved);
});
apiRouter.post('/sessions/:id/items', (req, res) => {
  const session = Store.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session not found' });
  const item = req.body || {};
  if (!item.type) return res.status(400).json({ error: 'type is required' });
  const saved = Store.addSessionItem({ ...item, session_id: req.params.id });
  return res.status(201).json(saved);
});
apiRouter.put('/session-items/:id', (req, res) => {
  const updated = Store.updateSessionItem(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'not found' });
  return res.json(updated);
});
apiRouter.delete('/session-items/:id', (req, res) => {
  Store.deleteSessionItem(req.params.id);
  return res.json({ ok: true });
});
apiRouter.put('/sessions/:id/finish', (req, res) => {
  const finished = Store.finishSession(req.params.id);
  if (!finished) return res.status(404).json({ error: 'not found' });
  return res.json(finished);
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
  res.json({ ...row, linksList: Store.getGearLinks(req.params.id), imagesList: Store.listGearImages(req.params.id) });
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
apiRouter.post('/presets/:id/audio', upload.single('file'), (req, res) => {
  const preset = Store.getPreset(req.params.id);
  if (!preset) return res.status(404).json({ error: 'not found' });
  const file = req.file;
  if (!file || !file.buffer?.length) return res.status(400).json({ error: 'audio file is required' });
  const safePresetId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '') || 'preset';
  const sourceExt = path.extname(file.originalname || '').replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
  const fallbackExtByMime = {
    'audio/webm': '.webm',
    'audio/mp4': '.m4a',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/ogg': '.ogg',
  };
  const ext = sourceExt || fallbackExtByMime[String(file.mimetype || '').toLowerCase()] || '.webm';
  const fileName = `${safePresetId}-${Date.now()}${ext}`;
  fs.writeFileSync(path.join(presetAudioDir, fileName), file.buffer);
  const updated = Store.savePreset({
    ...preset,
    audioData: null,
    audioPath: `uploads/preset-audio/${fileName}`,
    audioMime: file.mimetype || 'application/octet-stream',
  });
  return res.json({ ok: true, preset: updated });
});
apiRouter.delete('/presets/:id/audio', (req, res) => {
  const preset = Store.getPreset(req.params.id);
  if (!preset) return res.status(404).json({ error: 'not found' });
  if (preset.audioPath) {
    const absolutePath = path.join('/data', String(preset.audioPath).replace(/^\/+/, ''));
    if (absolutePath.startsWith('/data/') && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  }
  const updated = Store.savePreset({ ...preset, audioData: null, audioPath: null, audioMime: null, audioDuration: null });
  return res.json({ ok: true, preset: updated });
});
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

function saveGearImageFromBuffer({ fileName, mimeType, buffer }) {
  const ext = extensionFromMime(mimeType);
  const safeBase = sanitizeFileName(fileName).replace(/\.[^/.]+$/, '');
  const finalName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}.${ext}`;
  const fullPath = path.join(gearMediaDir, finalName);
  fs.writeFileSync(fullPath, buffer);
  return { filePath: `/media/gear/${finalName}` };
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

apiRouter.post('/gear-image', (req, res) => {
  try {
    const gearId = req.body?.gearId;
    const mimeType = req.body?.mime || req.body?.mimeType || 'image/jpeg';
    const fileName = req.body?.fileName || 'gear-image';
    let dataBase64 = req.body?.dataBase64 || '';
    if (!gearId) return res.status(400).json({ error: 'gearId is required' });

    if (typeof dataBase64 === 'string' && dataBase64.startsWith('data:')) {
      const parts = dataBase64.split(',');
      if (parts.length === 2) dataBase64 = parts[1];
    }
    if (!dataBase64) return res.status(400).json({ error: 'image data is required' });

    const buffer = Buffer.from(dataBase64, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'invalid image payload' });

    const savedFile = saveGearImageFromBuffer({ fileName, mimeType, buffer });
    const row = Store.addGearImage({ gearId, filePath: savedFile.filePath, sortOrder: Number(req.body?.sortOrder) || 0 });
    return res.json({ id: row.id, filePath: row.filePath, createdAt: row.createdAt, sortOrder: row.sortOrder });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'failed to save gear image' });
  }
});

apiRouter.get('/gear/:id/images', (req, res) => {
  res.json(Store.listGearImages(req.params.id));
});

apiRouter.delete('/gear-image/:id', (req, res) => {
  const row = Store.getGearImage(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  Store.deleteGearImage(req.params.id);
  if (row.filePath && row.filePath.startsWith('/media/gear/')) {
    const fullPath = path.join(gearMediaDir, path.basename(row.filePath));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  return res.json({ ok: true });
});



async function hydrateLessonVideo(payload = {}) {
  if (!payload.video_url) return payload;
  const videoId = extractYouTubeId(payload.video_url);
  if (!videoId) return payload;
  payload.video_provider = payload.video_provider || 'youtube';
  payload.video_id = payload.video_id || videoId;
  if (payload.title && payload.thumb_url) return payload;
  try {
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const meta = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`, { 'User-Agent': 'faithfulfret' });
    payload.title = payload.title || meta.title || '';
    payload.thumb_url = payload.thumb_url || meta.thumbnail_url || '';
  } catch (error) {
    // ignore oembed failure
  }
  return payload;
}

apiRouter.get('/oembed', async (req, res) => {
  const rawUrl = String(req.query.url || '').trim();
  if (!rawUrl) return res.status(400).json({ error: 'url is required' });
  const normalizedUrl = rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`;
  const videoId = extractYouTubeId(normalizedUrl);
  if (!videoId) return res.status(400).json({ error: 'only valid youtube URLs are supported' });
  try {
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`;
    const data = await fetchJson(oembedUrl, { 'User-Agent': 'faithfulfret' });
    return res.json({
      title: data.title || '',
      author: data.author_name || '',
      author_name: data.author_name || '',
      thumb_url: data.thumbnail_url || '',
      thumbnail_url: data.thumbnail_url || '',
      provider: 'youtube',
      video_id: videoId,
      url: canonicalUrl,
    });
  } catch (error) {
    return res.status(502).json({ error: 'failed to fetch oembed metadata' });
  }
});


apiRouter.get('/training/providers', (req, res) => res.json(Store.listTrainingProviders()));
apiRouter.post('/training/providers', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'name is required' });
  try { return res.status(201).json(Store.saveTrainingProvider(req.body || {})); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});
apiRouter.put('/training/providers/:id', (req, res) => {
  const existing = Store.getTrainingProvider(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  try { return res.json(Store.saveTrainingProvider({ ...existing, ...req.body, id: Number(req.params.id) })); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});
apiRouter.delete('/training/providers/:id', (req, res) => { Store.deleteTrainingProvider(req.params.id); return res.json({ ok: true }); });

apiRouter.get('/training/levels', (req, res) => res.json(Store.listLevels(req.query.provider_id)));
apiRouter.post('/training/levels/bootstrap', (req, res) => {
  if (!req.body?.provider_id) return res.status(400).json({ error: 'provider_id is required' });
  try { return res.status(201).json(Store.bootstrapProviderLevels(req.body.provider_id)); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});

apiRouter.get('/training/modules', (req, res) => res.json(Store.listTrainingModules(req.query.level_id)));
apiRouter.post('/training/modules', (req, res) => {
  if (!req.body?.level_id) return res.status(400).json({ error: 'level_id is required' });
  if (!req.body?.title) return res.status(400).json({ error: 'title is required' });
  try { return res.status(201).json(Store.saveTrainingModule(req.body || {})); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});
apiRouter.put('/training/modules/:id', (req, res) => {
  const existing = Store.getTrainingModule(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  try { return res.json(Store.saveTrainingModule({ ...existing, ...req.body, id: Number(req.params.id) })); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});

apiRouter.get('/training/lessons', (req, res) => res.json(Store.listTrainingLessons(req.query || {})));
apiRouter.get('/training/lessons/:id', (req, res) => {
  const lesson = Store.getTrainingLesson(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'not found' });
  return res.json(lesson);
});
apiRouter.post('/training/lessons', async (req, res) => {
  try {
    const payload = await hydrateLessonVideo(req.body || {});
    if (!payload.title && !payload.video_url) return res.status(400).json({ error: 'title or video_url is required' });
    return res.status(201).json(Store.saveTrainingLesson(payload));
  } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});
apiRouter.put('/training/lessons/:id', async (req, res) => {
  const existing = Store.getTrainingLesson(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  try {
    const payload = await hydrateLessonVideo({ ...existing, ...req.body, id: Number(req.params.id) });
    return res.json(Store.saveTrainingLesson(payload));
  } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});
apiRouter.delete('/training/lessons/:id', (req, res) => { Store.deleteTrainingLesson(req.params.id); return res.json({ ok: true }); });

apiRouter.get('/training/skill-groups', (req, res) => res.json(Store.listSkillGroups()));
apiRouter.get('/training/skills/:slug/lessons', (req, res) => res.json(Store.getSkillLessons(req.params.slug)));

apiRouter.get('/training/songs', (req, res) => res.json(Store.listSongs(req.query || {})));
apiRouter.get('/training/songs/:id', (req, res) => {
  const song = Store.getSong(req.params.id);
  if (!song) return res.status(404).json({ error: 'not found' });
  return res.json(song);
});
apiRouter.post('/training/songs', (req, res) => {
  if (!req.body?.provider_id) return res.status(400).json({ error: 'provider_id is required' });
  if (!req.body?.title) return res.status(400).json({ error: 'title is required' });
  try { return res.status(201).json(Store.saveSong(req.body || {})); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});
apiRouter.put('/training/songs/:id', (req, res) => {
  const existing = Store.getSong(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  try { return res.json(Store.saveSong({ ...existing, ...req.body, id: Number(req.params.id) })); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});
apiRouter.delete('/training/songs/:id', (req, res) => { Store.deleteSong(req.params.id); return res.json({ ok: true }); });
apiRouter.post('/training/songs/:id/lessons', (req, res) => {
  const existing = Store.getSong(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const lessonIds = Array.isArray(req.body?.lesson_ids) ? req.body.lesson_ids : [];
  try { return res.json(Store.assignSongLessons(req.params.id, lessonIds)); } catch (e) { return res.status(400).json({ error: e.message || 'failed' }); }
});


apiRouter.get('/providers', (req, res) => {
  res.json(Store.listProviders());
});

apiRouter.post('/providers', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'name is required' });
  try {
    const saved = Store.saveProvider(req.body || {});
    return res.status(201).json(saved);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'failed to save provider' });
  }
});

apiRouter.get('/courses', (req, res) => {
  res.json(Store.listCourses(req.query.providerId));
});

apiRouter.post('/courses', (req, res) => {
  if (!req.body?.provider_id) return res.status(400).json({ error: 'provider_id is required' });
  if (!req.body?.title) return res.status(400).json({ error: 'title is required' });
  try {
    return res.status(201).json(Store.saveCourse(req.body || {}));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'failed to save course' });
  }
});

apiRouter.get('/modules', (req, res) => {
  res.json(Store.listModules(req.query.courseId));
});

apiRouter.post('/modules', (req, res) => {
  if (!req.body?.course_id) return res.status(400).json({ error: 'course_id is required' });
  if (!req.body?.title) return res.status(400).json({ error: 'title is required' });
  try {
    return res.status(201).json(Store.saveModule(req.body || {}));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'failed to save module' });
  }
});

apiRouter.get('/lessons', (req, res) => {
  const lessons = Store.listLessons({ moduleId: req.query.moduleId, q: req.query.q, skill: req.query.skill, type: req.query.type });
  res.json(lessons);
});

apiRouter.get('/lessons/:id', (req, res) => {
  const lesson = Store.getLesson(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'not found' });
  const stats = Store.getLessonStats(req.params.id);
  const history = Store.getLessonHistory(req.params.id);
  return res.json({
    ...lesson,
    stats: {
      times_completed: Number(stats?.times_completed) || 0,
      total_minutes_spent: Number(stats?.total_minutes_spent) || 0,
      first_completed_at: stats?.first_completed_at || null,
      last_completed_at: stats?.last_completed_at || null,
    },
    history_summary: {
      attempts: history.length,
      completed_attempts: history.filter((row) => Number(row.completed) === 1).length,
    },
    history,
    attachments: Store.listAttachments('lesson', req.params.id),
  });
});

apiRouter.post('/lessons', async (req, res) => {
  const payload = req.body || {};
  if (!payload.module_id) return res.status(400).json({ error: 'module_id is required' });
  if (!payload.title && !payload.video_url) return res.status(400).json({ error: 'title is required' });
  if (payload.video_url) {
    try {
      const meta = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(payload.video_url)}`, { 'User-Agent': 'faithfulfret' });
      payload.title = payload.title || meta.title || '';
      payload.thumb_url = payload.thumb_url || meta.thumbnail_url || '';
      payload.author = payload.author || meta.author_name || '';
      payload.video_provider = payload.video_provider || 'youtube';
      payload.video_id = payload.video_id || getVideoIdFromUrl(payload.video_url);
    } catch {
      // ignore metadata failure for create
    }
  }
  try {
    return res.status(201).json(Store.saveLesson(payload));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'failed to save lesson' });
  }
});

apiRouter.put('/lessons/:id', (req, res) => {
  const existing = Store.getLesson(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  try {
    const saved = Store.saveLesson({ ...existing, ...req.body, id: Number(req.params.id) });
    return res.json(saved);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'failed to update lesson' });
  }
});

apiRouter.delete('/lessons/:id', (req, res) => {
  const existing = Store.getLesson(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  Store.deleteLesson(req.params.id);
  return res.json({ ok: true });
});


apiRouter.get('/training-playlists', (req, res) => {
  res.json(Store.listTrainingPlaylists());
});

apiRouter.post('/training-playlists', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'name is required' });
  return res.status(201).json(Store.saveTrainingPlaylist(req.body || {}));
});

apiRouter.get('/training-playlists/:id', (req, res) => {
  const row = Store.getTrainingPlaylist(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  return res.json(row);
});

apiRouter.put('/training-playlists/:id', (req, res) => {
  const existing = Store.getTrainingPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  return res.json(Store.saveTrainingPlaylist({ ...existing, ...req.body, id: Number(req.params.id) }));
});

apiRouter.delete('/training-playlists/:id', (req, res) => {
  const existing = Store.getTrainingPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  Store.deleteTrainingPlaylist(req.params.id);
  return res.json({ ok: true });
});

apiRouter.get('/training-playlists/:id/items', (req, res) => {
  return res.json(Store.listTrainingPlaylistItems(req.params.id));
});

apiRouter.put('/training-playlists/:id/items', (req, res) => {
  const existing = Store.getTrainingPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  return res.json(Store.replaceTrainingPlaylistItems(req.params.id, items));
});

apiRouter.get('/lesson-stats/:id', (req, res) => {
  const stats = Store.getLessonStats(req.params.id);
  return res.json({
    times_completed: Number(stats?.times_completed) || 0,
    total_minutes_spent: Number(stats?.total_minutes_spent) || 0,
    first_completed_at: stats?.first_completed_at || null,
    last_completed_at: stats?.last_completed_at || null,
  });
});

apiRouter.post('/attachments', attachmentUpload.single('file'), (req, res) => {
  try {
    if (!req.file?.buffer?.length) return res.status(400).json({ error: 'file is required' });
    const entityType = String(req.body?.entity_type || '');
    const entityId = Number(req.body?.entity_id);
    if (!['lesson', 'video'].includes(entityType)) return res.status(400).json({ error: 'invalid entity_type' });
    if (!entityId) return res.status(400).json({ error: 'entity_id is required' });
    const safeOriginal = sanitizeUploadFileName(req.file.originalname || 'upload');
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeOriginal}`;
    const storagePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(storagePath, req.file.buffer);
    const kind = req.file.mimetype === 'application/pdf' ? 'pdf' : (req.file.mimetype.startsWith('image/') ? 'image' : 'file');
    const row = Store.saveAttachment({
      entity_type: entityType,
      entity_id: entityId,
      kind,
      filename: req.file.originalname || safeOriginal,
      mime: req.file.mimetype,
      size_bytes: req.file.size || req.file.buffer.length,
      storage_path: fileName,
      caption: req.body?.caption || '',
    });
    return res.status(201).json(row);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'failed to upload attachment' });
  }
});

apiRouter.get('/attachments', (req, res) => {
  const entityType = String(req.query.entity_type || '');
  const entityId = Number(req.query.entity_id);
  if (!entityType || !entityId) return res.status(400).json({ error: 'entity_type and entity_id are required' });
  return res.json(Store.listAttachments(entityType, entityId));
});

apiRouter.delete('/attachments/:id', (req, res) => {
  const row = Store.getAttachment(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  Store.deleteAttachment(req.params.id);
  const fullPath = path.join(uploadsDir, path.basename(row.storage_path || ''));
  if (fullPath.startsWith(uploadsDir) && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  return res.json({ ok: true });
});

apiRouter.get('/training-videos', (req, res) => {
  const track = String(req.query.difficulty_track || '').trim();
  const level = Number(req.query.difficulty_level);
  const rows = Store.listTrainingVideos({
    q: req.query.q,
    tags: req.query.tags,
    playlistId: req.query.playlistId,
    category: req.query.category,
    difficulty_track: track || undefined,
    difficulty_level: Number.isFinite(level) ? level : undefined,
    includeProgress: req.query.includeProgress,
  });
  res.json(rows.map(normalizeTrainingVideo));
});

apiRouter.get('/training-videos/:id', (req, res) => {
  const row = Store.getTrainingVideo(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  return res.json({
    ...normalizeTrainingVideo(row),
    timestamps: Store.listVideoTimestamps(req.params.id),
    playlists: Store.listPlaylistsByVideo(req.params.id),
  });
});

apiRouter.get('/training/videos/:id', (req, res) => {
  const row = Store.getTrainingVideo(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  return res.json(normalizeTrainingVideo(row));
});

apiRouter.get('/training/videos/:id/progress', (req, res) => {
  const video = Store.getTrainingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  return res.json(Store.getTrainingVideoProgress(req.params.id));
});

apiRouter.put('/training/videos/:id/progress', (req, res) => {
  const video = Store.getTrainingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  const payload = req.body || {};
  const changes = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'watched')) changes.watched = Boolean(payload.watched);
  if (Object.prototype.hasOwnProperty.call(payload, 'mastered')) changes.mastered = Boolean(payload.mastered);
  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) changes.notes = String(payload.notes ?? '');
  return res.json(Store.saveTrainingVideoProgress(req.params.id, changes));
});

apiRouter.post('/training/videos/:id/upload', trainingVideoUpload.single('file'), async (req, res) => {
  const video = Store.getTrainingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  if (!req.file?.buffer?.length) return res.status(400).json({ error: 'file is required' });

  const ext = (path.extname(req.file.originalname || '').replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '.mp4').slice(0, 10);
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const safeName = sanitizeUploadFileName(path.basename(req.file.originalname || `video${safeExt}`));
  const fileName = `${Date.now()}-${safeName || `video${safeExt}`}`;
  const videoDir = path.join(trainingVideosDir, String(Number(req.params.id)));
  fs.mkdirSync(videoDir, { recursive: true });
  const videoPath = path.join(videoDir, fileName);
  fs.writeFileSync(videoPath, req.file.buffer);

  let thumbnailUrl = null;
  let thumbnailPath = null;
  try {
    const result = await buildLocalVideoThumbnail({ id: Number(req.params.id), local_video_path: videoPath, upload_url: '' });
    if (result.ok) {
      thumbnailUrl = result.thumbnailUrl;
      thumbnailPath = result.thumbnail_path;
    }
  } catch (error) {
    console.warn('[training] thumbnail generation failed:', error.message || error);
  }

  const saved = Store.saveTrainingVideoUpload(req.params.id, {
    upload_url: `/uploads/videos/${Number(req.params.id)}/${fileName}`,
    upload_mime: req.file.mimetype || '',
    upload_size: req.file.size || req.file.buffer.length || 0,
    upload_original_name: req.file.originalname || fileName,
    local_video_path: videoPath,
    thumbnail_path: thumbnailPath,
    thumbnail_url: thumbnailUrl,
  });

  return res.json(normalizeTrainingVideo(saved));
});

apiRouter.post('/training/videos/:id/thumbnail', async (req, res) => {
  const video = Store.getTrainingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  const ffmpegReady = await hasFfmpeg();
  if (!ffmpegReady) return res.status(503).json({ error: 'ffmpeg not available' });
  const result = await buildLocalVideoThumbnail(video);
  if (!result.ok) return res.status(400).json({ error: result.error || 'thumbnail generation failed' });
  const updated = Store.getTrainingVideo(req.params.id);
  return res.json({ thumbnailUrl: result.thumbnailUrl, video: normalizeTrainingVideo(updated) });
});

apiRouter.post('/training-videos', async (req, res) => {
  const payload = req.body || {};
  const sourceType = String(payload.source_type || payload.sourceType || 'youtube').toLowerCase() === 'upload' ? 'upload' : 'youtube';
  if (sourceType === 'upload') {
    const savedUpload = Store.saveTrainingVideo({
      ...payload,
      source_type: 'upload',
      provider: payload.provider || 'upload',
      youtube_url: payload.youtube_url || '',
      url: payload.url || payload.youtube_url || '',
      thumbnail_url: payload.thumbnail_url || payload.thumbUrl || payload.thumb_url || '',
    });
    return res.status(201).json(savedUpload);
  }

  const videoId = payload.videoId || payload.video_id || extractYouTubeId(payload.youtube_url || payload.url);
  const youtubeUrl = payload.youtube_url || payload.url;
  if (!youtubeUrl) return res.status(400).json({ error: 'url is required' });
  if (!videoId) return res.status(400).json({ error: 'valid youtube videoId is required' });
  if (!payload.title || !(payload.thumbUrl || payload.thumb_url || payload.thumbnail_url)) {
    try {
      const meta = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { 'User-Agent': 'faithfulfret' });
      payload.title = payload.title || meta.title || '';
      payload.thumbUrl = payload.thumbUrl || payload.thumb_url || payload.thumbnail_url || meta.thumbnail_url || '';
    } catch {}
  }
  const saved = Store.saveTrainingVideo({ ...payload, source_type: 'youtube', provider: payload.provider || 'youtube', videoId, youtube_url: youtubeUrl, url: youtubeUrl, thumbnail_url: payload.thumbnail_url || payload.thumbUrl || payload.thumb_url || '' });
  return res.status(201).json(saved);
});

apiRouter.put('/training-videos/:id', async (req, res) => {
  const existing = Store.getTrainingVideo(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const payload = req.body || {};
  const sourceType = String(payload.source_type || payload.sourceType || existing.source_type || 'youtube').toLowerCase() === 'upload' ? 'upload' : 'youtube';

  if (sourceType === 'upload') {
    const savedUpload = Store.saveTrainingVideo({
      ...existing,
      ...payload,
      id: Number(req.params.id),
      source_type: 'upload',
      provider: payload.provider || existing.provider || 'upload',
      thumbnail_url: payload.thumbnail_url || payload.thumbUrl || payload.thumb_url || existing.thumbnail_url || existing.thumb_url || existing.thumbUrl || '',
    });
    return res.json(savedUpload);
  }

  const videoId = payload.videoId || payload.video_id || extractYouTubeId(payload.youtube_url || payload.url || existing.youtube_url || existing.url) || existing.videoId;
  if (!videoId) return res.status(400).json({ error: 'valid youtube videoId is required' });
  if ((!payload.title && !existing.title) || (!(payload.thumbUrl || payload.thumb_url || payload.thumbnail_url) && !(existing.thumbUrl || existing.thumb_url || existing.thumbnail_url))) {
    try {
      const meta = await fetchJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { 'User-Agent': 'faithfulfret' });
      payload.title = payload.title || existing.title || meta.title || '';
      payload.thumbUrl = payload.thumbUrl || payload.thumb_url || payload.thumbnail_url || existing.thumbUrl || existing.thumb_url || existing.thumbnail_url || meta.thumbnail_url || '';
    } catch {}
  }
  const saved = Store.saveTrainingVideo({ ...existing, ...payload, id: Number(req.params.id), source_type: 'youtube', youtube_url: payload.youtube_url || payload.url || existing.youtube_url || existing.url || '', url: payload.youtube_url || payload.url || existing.youtube_url || existing.url || '', videoId, provider: payload.provider || existing.provider || 'youtube', thumbnail_url: payload.thumbnail_url || payload.thumbUrl || payload.thumb_url || existing.thumbnail_url || '' });
  return res.json(saved);
});

apiRouter.delete('/training-videos/:id', (req, res) => {
  const existing = Store.getTrainingVideo(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  if (existing.source_type === 'upload' && existing.upload_url) {
    safeUnlink(existing.local_video_path || filePathFromUploadUrl(existing.upload_url, trainingVideosDir));
    safeUnlink(existing.thumbnail_path || filePathFromUploadUrl(existing.thumbnail_url, trainingThumbsDir));
  }

  Store.deleteTrainingVideo(req.params.id);
  return res.json({ ok: true });
});

apiRouter.post('/training-videos/:id/timestamps', (req, res) => {
  const video = Store.getTrainingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  const payload = req.body || {};
  if (!payload.label) return res.status(400).json({ error: 'label is required' });
  if (payload.seconds == null || Number.isNaN(Number(payload.seconds))) return res.status(400).json({ error: 'seconds is required' });
  const saved = Store.saveVideoTimestamp({ ...payload, videoId: Number(req.params.id) });
  return res.status(201).json(saved);
});

apiRouter.delete('/video-timestamps/:id', (req, res) => {
  Store.deleteVideoTimestamp(req.params.id);
  return res.json({ ok: true });
});

apiRouter.get('/video-playlists', (req, res) => {
  const playlists = Store.listVideoPlaylists().map((playlist) => {
    const items = Store.listPlaylistItems(playlist.id);
    return {
      ...playlist,
      items,
      video_count: Number(playlist.video_count) || items.length,
    };
  });
  return res.json(playlists);
});

apiRouter.get('/video-playlists/:id', (req, res) => {
  const playlist = playlistWithItems(req.params.id);
  if (!playlist) return res.status(404).json({ error: 'not found' });
  return res.json(playlist);
});

apiRouter.post('/video-playlists', (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: 'name is required' });
  const saved = Store.saveVideoPlaylist(req.body);
  return res.status(201).json(playlistWithItems(saved.id));
});

apiRouter.put('/video-playlists/:id', (req, res) => {
  const existing = Store.getVideoPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const saved = Store.saveVideoPlaylist({ ...existing, ...req.body, id: Number(req.params.id) });
  return res.json(playlistWithItems(saved.id));
});

apiRouter.delete('/video-playlists/:id', (req, res) => {
  const existing = Store.getVideoPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  Store.deleteVideoPlaylist(req.params.id);
  return res.json({ ok: true });
});

apiRouter.put('/video-playlists/:id/items', (req, res) => {
  const existing = Store.getVideoPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  Store.replacePlaylistItems(req.params.id, items);
  return res.json(playlistWithItems(req.params.id));
});


apiRouter.get('/videos/:id/attachments', (req, res) => {
  const video = Store.getTrainingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });
  return res.json(Store.listVideoAttachments(req.params.id));
});

apiRouter.post('/videos/:id/attachments', attachmentUpload.single('file'), (req, res) => {
  const video = Store.getTrainingVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'video not found' });

  if (req.file) {
    const file = req.file;
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileName = `${stamp}-${sanitizeUploadFileName(file.originalname || 'upload.bin')}`;
    const storagePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(storagePath, file.buffer);
    const kind = file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    const row = Store.saveVideoAttachment({
      video_id: Number(req.params.id),
      kind,
      title: req.body?.title || file.originalname || fileName,
      url: `/uploads/${fileName}`,
      filename: file.originalname || fileName,
      mime: file.mimetype,
      size_bytes: file.size,
      storage_path: fileName,
    });
    return res.status(201).json(row);
  }

  const title = String(req.body?.title || '').trim();
  const url = String(req.body?.url || '').trim();
  if (!url) return res.status(400).json({ error: 'file upload or url is required' });
  const row = Store.saveVideoAttachment({
    video_id: Number(req.params.id),
    kind: 'link',
    title,
    url,
    filename: '',
    mime: '',
    size_bytes: 0,
    storage_path: '',
  });
  return res.status(201).json(row);
});

apiRouter.delete('/video-attachments/:id', (req, res) => {
  const row = Store.getVideoAttachment(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  Store.deleteVideoAttachment(req.params.id);
  if (row.storage_path) {
    const fullPath = path.join(uploadsDir, path.basename(row.storage_path || ''));
    if (fullPath.startsWith(uploadsDir) && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
  return res.json({ ok: true });
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
  res.json(withExportMeta(buildJsonExport()));
});

apiRouter.get('/backup/export', (req, res) => {
  res.json(withExportMeta(buildJsonExport()));
});



function createSafeSqliteBackup() {
  Store.checkpointWal();
  const source = Store.dbPath;
  const tmpPath = path.join(os.tmpdir(), `faithfulfret-sqlite-backup-${Date.now()}.sqlite`);

  if (typeof Store.backupToFile === 'function') {
    try {
      Store.backupToFile(tmpPath);
      return tmpPath;
    } catch (error) {
      console.warn('[EXPORT ZIP] sqlite backup API failed, trying sqlite3 shell:', error.message);
    }
  }

  try {
    execSync(`sqlite3 ${JSON.stringify(source)} ".backup ${tmpPath}"`, { stdio: 'ignore' });
    return tmpPath;
  } catch (error) {
    console.warn('[EXPORT ZIP] sqlite3 backup failed, using file copy fallback:', error.message);
  }

  fs.copyFileSync(source, tmpPath);
  return tmpPath;
}

apiRouter.get('/export/zip', async (req, res) => {
  let backupPath = null;
  try {
    backupPath = createSafeSqliteBackup();
    const zip = new JSZip();
    zip.file('faithfulfret.sqlite', fs.readFileSync(backupPath));
    zip.file('export.json', JSON.stringify(withExportMeta(buildJsonExport()), null, 2));
    copyTreeIntoZip(zip, gearMediaDir, 'gear');
    copyTreeIntoZip(zip, presetMediaDir, 'presets');

    const payload = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `faithfulfret-backup-${dateStr}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(payload);
  } catch (e) {
    res.status(500).json({ error: e.message || 'failed to export zip backup' });
  } finally {
    if (backupPath && fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  }
});

apiRouter.post('/import', (req, res) => {
  try {
    const payload = req.body || {};
    const counts = restoreFromPayload(payload);
    res.json({ ok: true, counts, schemaVersion: payload.schemaVersion || 1 });
  } catch (e) {
    res.status(400).json({ error: e.message || 'invalid import payload' });
  }
});

apiRouter.post('/backup/import', (req, res) => {
  try {
    const payload = req.body || {};
    const counts = restoreFromPayload(payload);
    res.json({ ok: true, counts, schemaVersion: payload.schemaVersion || 1, localSettings: payload.localSettings || {} });
  } catch (e) {
    res.status(400).json({ error: e.message || 'invalid import payload' });
  }
});



apiRouter.post('/import/zip', upload.single('backupZip'), async (req, res) => {
  if (!req.file?.buffer?.length) return res.status(400).json({ error: 'backup zip file is required' });

  const timestamp = Date.now();
  const stamp = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
  const tempRoot = path.join(os.tmpdir(), `faithfulfret-restore-${timestamp}`);
  const tempExtract = path.join(tempRoot, 'extract');
  const backupStampDir = path.join(restoreBackupDir, stamp);

  isMaintenanceMode = true;
  try {
    fs.mkdirSync(tempExtract, { recursive: true });
    fs.mkdirSync(backupStampDir, { recursive: true });

    const zip = await JSZip.loadAsync(req.file.buffer);
    const files = Object.values(zip.files);
    for (const file of files) {
      if (file.dir) continue;
      const rel = file.name.replace(/^\/+/, '');
      const outPath = path.join(tempExtract, rel);
      if (!outPath.startsWith(tempExtract)) throw new Error('invalid zip path');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const content = await file.async('nodebuffer');
      fs.writeFileSync(outPath, content);
    }

    const dbFromZip = path.join(tempExtract, 'faithfulfret.sqlite');
    const oldDbPath = Store.dbPath;

    if (fs.existsSync(oldDbPath)) {
      fs.copyFileSync(oldDbPath, path.join(backupStampDir, `faithfulfret.sqlite.${stamp}.bak`));
    }

    if (fs.existsSync(gearMediaDir)) fs.cpSync(gearMediaDir, path.join(backupStampDir, 'gear'), { recursive: true });
    if (fs.existsSync(presetMediaDir)) fs.cpSync(presetMediaDir, path.join(backupStampDir, 'presets'), { recursive: true });

    if (fs.existsSync(dbFromZip)) {
      Store.close();
      fs.copyFileSync(dbFromZip, oldDbPath);
      Store.reopen();
    }

    copyTreeFromTemp(path.join(tempExtract, 'gear'), gearMediaDir, true);
    copyTreeFromTemp(path.join(tempExtract, 'presets'), presetMediaDir, true);

    if (!fs.existsSync(dbFromZip) && fs.existsSync(path.join(tempExtract, 'export.json'))) {
      const payload = JSON.parse(fs.readFileSync(path.join(tempExtract, 'export.json'), 'utf8'));
      restoreFromPayload(payload);
    }

    res.json({ ok: true, dbInfo: Store.getDbInfo() });
  } catch (e) {
    try {
      Store.reopen();
    } catch (ignored) {}
    res.status(400).json({ error: e.message || 'failed to import zip backup' });
  } finally {
    isMaintenanceMode = false;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
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

apiRouter.use((err, req, res, next) => {
  if (!err) return next();
  return res.status(400).json({ error: err.message || 'request failed' });
});

app.use('/api', apiRouter);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use('/media/presets', express.static(presetMediaDir));
app.use('/media/gear', express.static(gearMediaDir));
app.use('/uploads/videos', express.static(trainingVideosDir, { maxAge: 0 }));
app.use('/uploads/thumbnails', express.static(trainingThumbsDir, { maxAge: 0 }));
app.use('/uploads', express.static('/data/uploads', { maxAge: 0 }));
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — return index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Daily Fret running on port ${PORT}`);
});

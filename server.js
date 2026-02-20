const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync, exec, execFile } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const JSZip = require('jszip');
const multer = require('multer');
const Store = require('./data-store');

const app = express();
const apiRouter = express.Router();
const PORT = process.env.PORT || 9999;
const presetMediaDir = '/data/presets';
const gearMediaDir = '/data/gear';
const uploadsDir = '/data/uploads';
const presetAudioDir = '/data/uploads/preset-audio';
if (!fs.existsSync(presetMediaDir)) fs.mkdirSync(presetMediaDir, { recursive: true });
if (!fs.existsSync(gearMediaDir)) fs.mkdirSync(gearMediaDir, { recursive: true });
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(presetAudioDir)) fs.mkdirSync(presetAudioDir, { recursive: true });
const restoreBackupDir = '/data/_restore_backup';
if (!fs.existsSync(restoreBackupDir)) fs.mkdirSync(restoreBackupDir, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });
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
let backupQueue = Promise.resolve();

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

function withBackupLock(task) {
  const run = backupQueue.then(() => task());
  backupQueue = run.catch(() => {});
  return run;
}

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function listPersistentDataDirs() {
  const ignore = new Set(['_export_tmp', '_import_tmp', '_restore_backup']);
  if (!fs.existsSync('/data')) return [];
  return fs.readdirSync('/data', { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !ignore.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function walkFiles(rootDir, relPrefix = '') {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(rootDir, entry.name);
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, rel));
      continue;
    }
    const stat = fs.statSync(abs);
    out.push({ abs, rel, size: stat.size });
  }
  return out;
}

function mkdirIfMissing(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createSafeSqliteBackup(destPath) {
  Store.checkpointWal();
  if (typeof Store.backupToFile === 'function') {
    Store.backupToFile(destPath);
    return destPath;
  }
  fs.copyFileSync(Store.dbPath, destPath);
  return destPath;
}

async function buildBackupStagingDir() {
  const stamp = backupStamp();
  const stageRoot = path.join('/data/_export_tmp', stamp);
  mkdirIfMissing(stageRoot);
  mkdirIfMissing(path.join('/data/_export_tmp'));

  const sqliteFileName = 'faithfulfret.sqlite';
  const dbSnapshotPath = path.join(stageRoot, sqliteFileName);
  createSafeSqliteBackup(dbSnapshotPath);

  const dataDirs = listPersistentDataDirs();
  dataDirs.forEach((dirName) => {
    const src = path.join('/data', dirName);
    const dst = path.join(stageRoot, dirName);
    if (!fs.existsSync(src)) return;
    fs.cpSync(src, dst, { recursive: true, force: true });
  });

  const files = walkFiles(stageRoot);
  const checksums = {};
  files.forEach((entry) => {
    checksums[entry.rel] = { sha256: sha256File(entry.abs), size: entry.size };
  });
  const schemaVersion = typeof Store.getSchemaVersion === 'function' ? Store.getSchemaVersion() : null;
  const manifest = {
    exportVersion: 1,
    appVersion: process.env.npm_package_version || null,
    buildHash: gitExec('git rev-parse --short HEAD') || null,
    createdAt: new Date().toISOString(),
    schemaVersion,
    sqliteFileName,
    dataDirectories: dataDirs,
    counts: { files: files.length, bytes: files.reduce((sum, f) => sum + f.size, 0) },
    checksums,
  };
  fs.writeFileSync(path.join(stageRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { stamp, stageRoot, manifest };
}

async function zipStagingToResponse(stageRoot, res, fileName) {
  const zip = new JSZip();
  walkFiles(stageRoot).forEach((entry) => {
    zip.file(entry.rel, fs.readFileSync(entry.abs));
  });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  await new Promise((resolve, reject) => {
    const stream = zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 6 } });
    stream.on('error', reject);
    res.on('close', resolve);
    stream.pipe(res);
  });
}

function verifyManifestChecksums(stageRoot, manifest) {
  const checksums = manifest?.checksums;
  if (!checksums || typeof checksums !== 'object') throw new Error('manifest checksums are missing');
  Object.entries(checksums).forEach(([rel, expected]) => {
    const abs = path.join(stageRoot, rel);
    if (!abs.startsWith(stageRoot)) throw new Error(`invalid checksum path: ${rel}`);
    if (!fs.existsSync(abs)) throw new Error(`missing file from backup: ${rel}`);
    const actual = sha256File(abs);
    if (actual !== expected.sha256) throw new Error(`checksum mismatch: ${rel}`);
  });
}

function createRestoreSnapshot(snapshotDir) {
  mkdirIfMissing(snapshotDir);
  const dbBackupPath = path.join(snapshotDir, 'faithfulfret.sqlite');
  createSafeSqliteBackup(dbBackupPath);
  ['-wal', '-shm'].forEach((suffix) => {
    const src = `${Store.dbPath}${suffix}`;
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(snapshotDir, `faithfulfret.sqlite${suffix}`));
  });
  listPersistentDataDirs().forEach((dirName) => {
    const src = path.join('/data', dirName);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(snapshotDir, dirName), { recursive: true, force: true });
  });
}

function applySnapshot(snapshotDir) {
  const dbPath = Store.dbPath;
  Store.close();
  ['','-wal','-shm'].forEach((suffix) => {
    const src = path.join(snapshotDir, `faithfulfret.sqlite${suffix}`);
    const dst = `${dbPath}${suffix}`;
    if (fs.existsSync(src)) fs.copyFileSync(src, dst);
    else if (fs.existsSync(dst)) fs.rmSync(dst, { force: true });
  });

  const backupDirs = fs.readdirSync(snapshotDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  listPersistentDataDirs().forEach((dirName) => {
    const full = path.join('/data', dirName);
    if (!backupDirs.includes(dirName) && fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
  });
  backupDirs.forEach((dirName) => {
    const src = path.join(snapshotDir, dirName);
    const dst = path.join('/data', dirName);
    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(src, dst, { recursive: true, force: true });
  });
  Store.reopen();
}

function applyImportedStage(importStage, manifest) {
  const sqlitePath = path.join(importStage, manifest.sqliteFileName || 'faithfulfret.sqlite');
  if (!fs.existsSync(sqlitePath)) throw new Error('sqlite file missing from backup');
  Store.close();
  fs.copyFileSync(sqlitePath, Store.dbPath);

  const importedDirs = Array.isArray(manifest.dataDirectories) ? manifest.dataDirectories : [];
  listPersistentDataDirs().forEach((dirName) => {
    if (!importedDirs.includes(dirName)) {
      const target = path.join('/data', dirName);
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    }
  });
  importedDirs.forEach((dirName) => {
    const src = path.join(importStage, dirName);
    const dst = path.join('/data', dirName);
    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
    if (fs.existsSync(src)) fs.cpSync(src, dst, { recursive: true, force: true });
  });

  Store.reopen();
  const integrity = typeof Store.runIntegrityCheck === 'function' ? Store.runIntegrityCheck() : 'ok';
  if (!String(integrity).toLowerCase().includes('ok')) throw new Error(`integrity check failed: ${integrity}`);
  const required = ['sessions', 'gear_items', 'presets', 'resources'];
  const tables = typeof Store.listUserTables === 'function' ? Store.listUserTables() : [];
  required.forEach((name) => {
    if (!tables.includes(name)) throw new Error(`required table missing after import: ${name}`);
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
  return video.youtube_url || video.url || '';
}

function normalizeTrainingVideo(row = {}) {
  const thumb = resolveTrainingThumb(row);
  return {
    ...row,
    hasLocalVideo: false,
    thumbUrl: thumb,
    thumb_url: thumb,
    thumbnail_url: thumb,
    watch_url: resolveTrainingWatchUrl(row),
  };
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

function runYtDlpJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    execFile('yt-dlp', ['-J', '--no-warnings', '--skip-download', url], { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 4 }, (error, stdout) => {
      if (error) {
        if (error.code === 'ENOENT') {
          error.missingBinary = true;
        }
        return reject(error);
      }
      try {
        return resolve(JSON.parse(stdout || '{}'));
      } catch (parseError) {
        return reject(new Error('invalid metadata response'));
      }
    });
  });
}

function pickBestThumbnail(meta = {}) {
  if (meta.thumbnail) return String(meta.thumbnail);
  const thumbs = Array.isArray(meta.thumbnails) ? meta.thumbnails : [];
  const usable = thumbs
    .map((item) => ({
      url: String(item?.url || ''),
      width: Number(item?.width) || 0,
      height: Number(item?.height) || 0,
    }))
    .filter((item) => item.url);
  if (!usable.length) return '';
  usable.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  return usable[0].url;
}

function normalizeYtMetadata(meta = {}, fallbackUrl = '') {
  const durationRaw = Number(meta.duration);
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : null;
  return {
    title: String(meta.title || ''),
    thumbnail_url: pickBestThumbnail(meta),
    duration_seconds: duration,
    source: 'youtube',
    uploader: meta.uploader ? String(meta.uploader) : '',
    webpage_url: String(meta.webpage_url || fallbackUrl || ''),
  };
}

async function fetchYoutubeMetadata(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error('only valid youtube URLs are supported');
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const raw = await runYtDlpJson(canonicalUrl, 10000);
  return normalizeYtMetadata(raw, canonicalUrl);
}

function playlistWithItems(id) {
  const playlist = Store.getVideoPlaylist(id);
  if (!playlist) return null;
  const items = Store.listPlaylistItems(id);
  const enriched = items.map((item) => {
    const itemType = String(item.item_type || 'video');
    if (itemType === 'playlist') {
      const childPlaylistId = Number(item.child_playlist_id);
      const child = childPlaylistId ? Store.getVideoPlaylist(childPlaylistId) : null;
      const thumbnail = childPlaylistId ? Store.getPlaylistFirstThumbnail(childPlaylistId) : '';
      const childStats = childPlaylistId ? Store.getPlaylistStatsDeep(childPlaylistId) : null;
      return {
        ...item,
        item_type: 'playlist',
        child_playlist: child ? {
          id: child.id,
          name: child.name,
          description: child.description,
          thumbnail,
        } : null,
        deep_stats: childStats ? {
          deepVideoCount: Number(childStats.deepVideoCount) || 0,
          deepDurationSeconds: Number(childStats.deepDurationSeconds) || 0,
          unknownDurationCount: Number(childStats.unknownDurationCount) || 0,
        } : null,
      };
    }
    const videoId = Number(item.video_id || item.videoId);
    const video = videoId ? Store.getTrainingVideo(videoId) : null;
    const progress = videoId ? Store.getTrainingVideoProgress(videoId) : null;
    return {
      ...item,
      item_type: 'video',
      duration_seconds: Number(video?.duration_seconds) || 0,
      video,
      progress,
    };
  });
  const deepStats = Store.getPlaylistStatsDeep(id);
  return {
    ...playlist,
    deep_stats: {
      deepVideoCount: Number(deepStats.deepVideoCount) || 0,
      deepDurationSeconds: Number(deepStats.deepDurationSeconds) || 0,
      unknownDurationCount: Number(deepStats.unknownDurationCount) || 0,
    },
    deep_video_ids: Array.from(deepStats.deepVideoIds || []),
    items: enriched,
  };
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
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diffToMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diffToMonday);

  let sessionsThisWeek = 0;
  let minutesThisWeek = 0;
  sessions.forEach((row) => {
    const dateVal = row?.date ? new Date(`${row.date}T12:00:00`) : null;
    if (!dateVal || Number.isNaN(dateVal.getTime())) return;
    if (dateVal >= weekStart) {
      sessionsThisWeek += 1;
      minutesThisWeek += Number(row.durationMinutes) || 0;
    }
  });

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
    totalSessions: count,
    totalMinutes,
    totalPracticeMinutes: totalMinutes,
    totalHours,
    maxBPM,
    avgBPM,
    streak: currentStreak,
    currentStreak,
    longestStreak,
    lastSessionDate,
    lastPracticeDate: lastSessionDate,
    daysSinceLastSession,
    allDates,
    sessionsPerWeek,
    sessionsThisWeek,
    minutesThisWeek,
  };
}

function getTodayYmd() {
  return new Date().toISOString().split('T')[0];
}

function getStreakSummary() {
  const stats = buildStats();
  const settings = Store.getUserSettings();
  const state = Store.getStreakState();
  const sessions = Store.listSessions();
  const today = getTodayYmd();
  const loggedToday = sessions.some((row) => row.date === today);
  const [hours = 19, minutes = 0] = String(settings.usual_practice_time || '19:00').split(':').map((v) => Number(v) || 0);
  const now = new Date();
  const nudgeAt = new Date(now);
  nudgeAt.setHours(hours, minutes, 0, 0);
  const warning = !loggedToday && now.getTime() >= nudgeAt.getTime();
  const currentStreak = Number(stats.currentStreak) || 0;
  const previousStreak = Number(state.previous_streak) || 0;
  const broken = previousStreak > 0 && currentStreak === 0;
  const cooldownDays = Number(settings.streak_restore_cooldown_days) || 7;
  const maxUses = Number(settings.streak_restore_max_uses_per_30_days) || 1;
  const restoreUsedAt = Number(state.streak_restore_used_at) || 0;
  const usesIn30Days = restoreUsedAt && (Date.now() - restoreUsedAt) <= 30 * 86400000 ? 1 : 0;
  const cooldownReady = !restoreUsedAt || (Date.now() - restoreUsedAt) >= cooldownDays * 86400000;
  const canRestore = Boolean(Number(settings.allow_streak_restore)) && broken && cooldownReady && usesIn30Days < maxUses;
  return {
    currentStreak,
    longestStreak: Number(stats.longestStreak) || 0,
    loggedToday,
    warning,
    warningLabel: warning ? 'Don\'t break the chain' : '',
    nudgeTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    canRestore,
    previousStreak,
    restoreCooldownDays: cooldownDays,
    restoreUsedAt: restoreUsedAt || null,
  };
}

function evaluateMilestonesForSession() {
  const stats = buildStats();
  const milestones = [3, 7, 14, 30, 60, 90];
  milestones.forEach((value) => {
    if ((Number(stats.currentStreak) || 0) === value) {
      Store.addTimelineEvent({
        event_type: 'streak_milestone',
        title: `Streak milestone: ${value} days`,
        subtitle: 'Chain is holding strong.',
        entity_id: `streak:${value}`,
        payload: { streak: value },
      });
    }
  });
}

function evaluateBadges() {
  const sessions = Store.listSessions();
  const stats = buildStats();
  const totalHours = Number(stats.totalHours) || 0;
  const trainingVideos = Store.listTrainingVideos({ includeProgress: 1 });
  const hasCompletedTraining = trainingVideos.some((video) => Number(video.mastered_at) > 0);
  const definitions = [
    { key: 'first_session', title: 'First Session', description: 'You started your practice journey.', test: () => sessions.length >= 1 },
    { key: 'sessions_10', title: '10 Sessions', description: 'Steady and faithful.', test: () => sessions.length >= 10 },
    { key: 'sessions_25', title: '25 Sessions', description: 'Your routine is growing.', test: () => sessions.length >= 25 },
    { key: 'sessions_50', title: '50 Sessions', description: 'Halfway to 100 sessions.', test: () => sessions.length >= 50 },
    { key: 'sessions_100', title: '100 Sessions', description: 'Centurion session milestone.', test: () => sessions.length >= 100 },
    { key: 'hours_10', title: '10 Practice Hours', description: 'Time under tension pays off.', test: () => totalHours >= 10 },
    { key: 'hours_50', title: '50 Practice Hours', description: 'Deep work is compounding.', test: () => totalHours >= 50 },
    { key: 'hours_100', title: '100 Practice Hours', description: 'Big consistency win.', test: () => totalHours >= 100 },
    { key: 'bpm_personal_best', title: 'BPM Personal Best', description: 'New peak BPM logged.', test: () => Number(stats.maxBPM) > 0 },
    { key: 'training_first_complete', title: 'Training Finisher', description: 'First completed training module/video.', test: () => hasCompletedTraining },
  ];
  const unlocked = [];
  definitions.forEach((badge) => {
    if (!badge.test()) return;
    const row = Store.unlockBadge({
      badge_key: badge.key,
      title: badge.title,
      description: badge.description,
      encouragement: 'Well done—keep showing up.',
    });
    if (row && row.badge_key === badge.key && Number(row.unlocked_at) > Date.now() - 5000) {
      Store.addTimelineEvent({
        event_type: 'badge_unlocked',
        title: `Badge unlocked: ${badge.title}`,
        subtitle: badge.description,
        entity_id: `badge:${badge.key}`,
      });
      unlocked.push(row);
    }
  });
  return unlocked;
}

// Data API
apiRouter.get('/health', (req, res) => {
  res.json({ ok: true, db: Store.dbPath });
});

apiRouter.get('/db-info', (req, res) => {
  res.json(Store.getDbInfo());
});

apiRouter.get('/stats', (req, res) => {
  const base = buildStats();
  const streak = getStreakSummary();
  const settings = Store.getUserSettings();
  const badges = Store.listBadgeUnlocks();
  res.json({ ...base, streakDetail: streak, motivation: { streak, badges, settings } });
});

apiRouter.get('/stats/streak', (req, res) => {
  res.json(getStreakSummary());
});

apiRouter.post('/streak/restore', (req, res) => {
  const summary = getStreakSummary();
  if (!summary.canRestore) return res.status(400).json({ error: 'restore not available' });
  const sessions = Store.listSessions();
  const today = getTodayYmd();
  if (!sessions.some((row) => row.date === today)) {
    const restored = Store.saveSession({ date: today, title: 'Streak Restore Session', durationMinutes: 1, focus: 'Recovery', notes: 'Streak restore placeholder session.' });
    Store.addTimelineEvent({ event_type: 'session', title: 'Session logged', subtitle: restored.title || 'Practice session', entity_id: restored.id, payload: { restored: true } });
  }
  Store.saveStreakState({ streak_restore_used_at: Date.now() });
  Store.addTimelineEvent({
    event_type: 'streak_restored',
    title: 'Streak restored',
    subtitle: `Restored to ${summary.previousStreak || 1} days`,
    entity_id: 'streak:restore',
  });
  return res.json(getStreakSummary());
});

apiRouter.get('/motivation/settings', (req, res) => {
  res.json(Store.getUserSettings());
});

apiRouter.put('/motivation/settings', (req, res) => {
  res.json(Store.saveUserSettings(req.body || {}));
});

apiRouter.get('/badges', (req, res) => {
  res.json(Store.listBadgeUnlocks());
});

apiRouter.post('/badges/reset', (req, res) => {
  const result = Store.resetBadges();
  return res.json({ ok: true, ...result });
});

apiRouter.post('/timeline/clear', (req, res) => {
  const clearedTimelineEvents = Store.clearTimelineEvents();
  return res.json({ ok: true, clearedTimelineEvents });
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
apiRouter.get('/timeline', (req, res) => {
  try {
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;
    const offsetRaw = Number.parseInt(req.query.offset, 10);
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
    const eventType = String(req.query.eventType || '').trim();
    const items = Store.listTimelineEvents({ limit, offset, eventType });
    const total = Store.countTimelineEvents({ eventType });
    return res.json({ items, total, limit, offset, eventType: eventType || '' });
  } catch (error) {
    console.error('timeline route failed', error);
    return res.status(500).json({ error: error.message || 'timeline failed' });
  }
});

apiRouter.get('/feed', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  try {
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 10;
    const offsetRaw = Number.parseInt(req.query.offset, 10);
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
    const parseTypeList = (value) => String(value || '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const selectedTypes = new Set([
      ...parseTypeList(req.query.types),
      ...parseTypeList(req.query.type),
    ]);
    const hasTypeFilter = selectedTypes.size > 0;

    const toTs = (...values) => {
      for (const value of values) {
        if (value == null || value === '') continue;
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
        const parsed = new Date(String(value)).getTime();
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      return 0;
    };

    const safeThumbSource = (value) => {
      const src = String(value || '').trim();
      if (!src) return '';
      if (/^https?:\/\//i.test(src)) return src;
      if (src.startsWith('/')) return src;
      return '';
    };

    const makeIconThumb = (icon) => ({ kind: 'icon', icon });
    const countsByType = {
      session: 0,
      gear: 0,
      training: 0,
      video: 0,
      playlist: 0,
      resource: 0,
      preset: 0,
      song: 0,
      badge: 0,
      system: 0,
    };
    const items = [];
    const pushItem = (item) => {
      if (!item || !item.id || !item.type || !Number(item.ts)) return;
      items.push(item);
      if (Object.prototype.hasOwnProperty.call(countsByType, item.type)) countsByType[item.type] += 1;
    };

    Store.listSessions().forEach((session) => {
      const tags = [session.focus, session.focusTag].map((value) => String(value || '').trim()).filter(Boolean);
      const uniqueTags = [...new Set(tags)].slice(0, 4);
      const notes = String(session.notes || '').trim();
      const win = String(session.win || '').trim();
      pushItem({
        id: `session:${session.id}`,
        type: 'session',
        ts: toTs(`${session.date}T12:00:00`, session.createdAt),
        title: String(session.title || session.focus || session.focusTag || `Session ${session.id}`).trim(),
        subtitle: notes.split(/\r?\n/).find(Boolean) || win || 'Practice session',
        href: `#/session/${session.id}`,
        thumb: makeIconThumb('metronome'),
        meta: {
          minutes: Number(session.durationMinutes) || null,
          bpm: Number(session.bpm) || null,
          tags: uniqueTags,
        },
        accent: 'accent',
      });
    });

    Store.listGear(true).forEach((gear) => {
      const firstImage = safeThumbSource(gear.imageData) || safeThumbSource((gear.imagesList && gear.imagesList[0] && gear.imagesList[0].filePath) || '');
      const status = String(gear.status || '').trim();
      pushItem({
        id: `gear:${gear.id}`,
        type: 'gear',
        ts: toTs(gear.createdAt, gear.dateAcquired, gear.boughtDate),
        title: String(gear.name || `${gear.brand || ''} ${gear.model || ''}` || `Gear ${gear.id}`).trim(),
        subtitle: status.toLowerCase() === 'sold' ? 'Marked as sold' : `${status || 'Tracked'} gear`,
        href: `#/gear/edit/${gear.id}`,
        thumb: firstImage ? { kind: 'image', src: firstImage } : makeIconThumb('guitar'),
        meta: {
          label: gear.category || gear.type || null,
        },
        accent: status.toLowerCase() === 'sold' ? 'yellow' : 'green',
      });
    });

    Store.listTrainingVideos({ includeProgress: 1 }).forEach((video) => {
      const videoThumb = safeThumbSource(video.thumbnail_url) || safeThumbSource(video.thumb_url) || safeThumbSource(video.thumbUrl);
      const createdTs = toTs(video.createdAt, video.updatedAt);
      pushItem({
        id: `video:${video.id}`,
        type: 'video',
        ts: createdTs,
        title: String(video.title || `Video ${video.id}`).trim(),
        subtitle: String(video.author || video.category || 'Training video').trim(),
        href: `#/training/videos/${video.id}`,
        thumb: videoThumb ? { kind: 'image', src: videoThumb } : makeIconThumb('video'),
        meta: {
          tags: String(video.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 3),
        },
        accent: 'neutral',
      });

      const watchedTs = toTs(video.watched_at);
      const masteredTs = toTs(video.mastered_at);
      const trainingTs = masteredTs || watchedTs;
      if (trainingTs) {
        pushItem({
          id: `training:${video.id}`,
          type: 'training',
          ts: trainingTs,
          title: masteredTs ? `Completed: ${video.title || `Video ${video.id}`}` : `Started: ${video.title || `Video ${video.id}`}`,
          subtitle: masteredTs ? 'Marked mastered' : 'Progress started',
          href: `#/training/videos/${video.id}`,
          thumb: videoThumb ? { kind: 'image', src: videoThumb } : makeIconThumb('play'),
          accent: masteredTs ? 'green' : 'accent',
        });
      }
    });

    Store.listVideoPlaylists({ scope: 'all' }).forEach((playlist) => {
      const ts = toTs(playlist.updatedAt, playlist.createdAt);
      pushItem({
        id: `playlist:${playlist.id}`,
        type: 'playlist',
        ts,
        title: String(playlist.name || `Playlist ${playlist.id}`).trim(),
        subtitle: playlist.updatedAt && Number(playlist.updatedAt) > Number(playlist.createdAt || 0) ? 'Playlist updated' : 'Playlist added',
        href: `#/training/playlists/${playlist.id}`,
        thumb: safeThumbSource(playlist.preview_thumbnail_url)
          ? { kind: 'image', src: safeThumbSource(playlist.preview_thumbnail_url) }
          : makeIconThumb('list'),
        meta: { extra: `${Number(playlist.video_count) || 0} items` },
        accent: 'accent',
      });
    });

    Store.listResources().forEach((resource) => {
      const ytThumb = (() => {
        const id = extractYouTubeId(resource.url || '');
        return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
      })();
      pushItem({
        id: `resource:${resource.id}`,
        type: 'resource',
        ts: toTs(resource.createdAt),
        title: String(resource.title || `Resource ${resource.id}`).trim(),
        subtitle: String(resource.category || 'Reference').trim(),
        href: `#/resources/edit/${resource.id}`,
        thumb: ytThumb ? { kind: 'image', src: ytThumb } : makeIconThumb('link'),
        accent: 'neutral',
      });
    });

    Store.listPresets().forEach((preset) => {
      let imagePath = '';
      try {
        const settings = typeof preset.settings === 'string' ? JSON.parse(preset.settings || '{}') : (preset.settings || {});
        imagePath = safeThumbSource(settings.imagePath);
      } catch (error) {
        imagePath = '';
      }
      pushItem({
        id: `preset:${preset.id}`,
        type: 'preset',
        ts: toTs(preset.createdAt),
        title: String(preset.name || `Preset ${preset.id}`).trim(),
        subtitle: String(preset.ampModel || 'Amp preset').trim(),
        href: '#/presets',
        thumb: imagePath ? { kind: 'image', src: imagePath } : makeIconThumb('knob'),
        meta: {
          tags: String(preset.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 3),
        },
        accent: 'yellow',
      });
    });

    Store.listRepertoireSongs({}).forEach((song) => {
      pushItem({
        id: `song:${song.id}`,
        type: 'song',
        ts: toTs(song.updated_at, song.created_at, song.last_practiced_at),
        title: String(song.title || `Song ${song.id}`).trim(),
        subtitle: String(song.status || 'learning').replace(/_/g, ' '),
        href: '#/songs',
        thumb: makeIconThumb('song'),
        meta: {
          tags: [song.artist, song.difficulty].filter(Boolean),
          bpm: Number(song.current_bpm) || null,
        },
        accent: song.status === 'performance_ready' ? 'red' : 'accent',
      });
    });

    Store.listBadgeUnlocks().forEach((badge) => {
      pushItem({
        id: `badge:${badge.badge_key}`,
        type: 'badge',
        ts: toTs(badge.unlocked_at),
        title: `Badge: ${badge.title}`,
        subtitle: badge.description || 'Achievement unlocked',
        href: '#/dashboard',
        thumb: makeIconThumb('badge'),
        accent: 'yellow',
      });
    });

    const timelineEntityExists = (entityType, entityId) => {
      const safeType = String(entityType || '').trim().toLowerCase();
      const safeId = String(entityId || '').trim();
      if (!safeType || !safeId) return true;
      if (safeType === 'session') return Boolean(Store.getSession(safeId));
      if (safeType === 'gear') return Boolean(Store.getGear(safeId));
      if (safeType === 'resource') return Boolean(Store.getResource(safeId));
      if (safeType === 'preset') return Boolean(Store.getPreset(safeId));
      if (safeType === 'video' || safeType === 'training') return Boolean(Store.getTrainingVideo(Number(safeId)));
      if (safeType === 'playlist') return Boolean(Store.getVideoPlaylist(Number(safeId)));
      if (safeType === 'song') return Boolean(Store.getRepertoireSong(Number(safeId)));
      if (safeType === 'badge') return Boolean(Store.getBadgeUnlockByKey(safeId));
      if (safeType === 'system') return true;
      return true;
    };

    const parseEntityRef = (eventType, entityIdRaw) => {
      const raw = String(entityIdRaw || '').trim();
      const fallbackByEvent = {
        session: 'session',
        song_added: 'song',
        song_practiced: 'song',
        song_status_changed: 'song',
        badge_unlocked: 'badge',
      };
      if (raw.includes(':')) {
        const [entityType, ...idParts] = raw.split(':');
        return { entityType: String(entityType || '').trim().toLowerCase(), entityId: idParts.join(':').trim() };
      }
      return { entityType: fallbackByEvent[String(eventType || '').trim()] || '', entityId: raw };
    };

    Store.listTimelineEvents({ limit: 500, offset: 0 }).forEach((event) => {
      const map = {
        session: 'session',
        gear: 'gear',
        training: 'training',
        video: 'video',
        playlist: 'playlist',
        resource: 'resource',
        preset: 'preset',
        badge_unlocked: 'badge',
        song_added: 'song',
        song_practiced: 'song',
        song_status_changed: 'song',
        streak_restored: 'system',
        streak_milestone: 'system',
      };
      const type = map[event.event_type] || 'system';
      const ref = parseEntityRef(event.event_type, event.entity_id);
      if (type === 'session' && ref.entityType === 'session') return;
      if (!timelineEntityExists(ref.entityType, ref.entityId)) return;
      pushItem({
        id: `evt:${event.id}`,
        type,
        ts: toTs(event.created_at),
        title: event.title,
        subtitle: event.subtitle || 'System activity',
        href: type === 'song' ? '#/songs' : '#/dashboard',
        thumb: makeIconThumb(type),
        accent: type === 'system' ? 'neutral' : 'accent',
      });
    });

    const sortedItems = items.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
    const filteredItems = hasTypeFilter ? sortedItems.filter((item) => selectedTypes.has(item.type)) : sortedItems;
    const total = filteredItems.length;
    if (offset >= total) return res.json({ items: [], total, facets: { countsByType } });
    const pagedItems = filteredItems.slice(offset, offset + limit);
    return res.json({ items: pagedItems, total, facets: { countsByType } });
  } catch (error) {
    console.error('feed route failed', error);
    return res.json({ items: [], total: 0, facets: { countsByType: { session: 0, gear: 0, training: 0, video: 0, playlist: 0, resource: 0, preset: 0, song: 0, badge: 0, system: 0 } } });
  }
});
apiRouter.get('/session-heatmap', (req, res) => res.json(Store.listSessionDailyTotals()));
apiRouter.post('/sessions', (req, res) => {
  if (!req.body?.date) {
    const session = Store.createDraftSession(req.body || {});
    return res.status(201).json({ id: session.id, ...session });
  }
  const saved = Store.saveSession(req.body);
  const streakBefore = Store.getStreakState();
  const streakNow = buildStats().currentStreak;
  if ((Number(streakBefore.previous_streak) || 0) > Number(streakNow || 0)) {
    Store.saveStreakState({ last_break_at: Date.now() });
  }
  Store.saveStreakState({ previous_streak: Number(streakNow) || 0 });
  evaluateMilestonesForSession();
  evaluateBadges();
  return res.json(saved);
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
apiRouter.get('/sessions/:id/songs', (req, res) => {
  res.json(Store.listSessionSongs(req.params.id));
});
apiRouter.put('/sessions/:id/songs', (req, res) => {
  const songs = Array.isArray(req.body?.songs) ? req.body.songs : [];
  songs.forEach((row) => {
    const sid = Number(row.song_id || row.id);
    if (!sid) return;
    const song = Store.getRepertoireSong(sid);
    if (song) {
      Store.saveRepertoireSong({ ...song, id: sid, last_practiced_at: Date.now() });
      Store.addTimelineEvent({ event_type: 'song_practiced', title: `Practiced: ${song.title}`, subtitle: 'Linked to session', entity_id: String(sid) });
    }
  });
  return res.json(Store.replaceSessionSongs(req.params.id, songs));
});

apiRouter.get('/repertoire/songs', (req, res) => {
  const status = String(req.query.status || '').trim();
  const sort = String(req.query.sort || 'last_practiced').trim();
  res.json(Store.listRepertoireSongs({ status, sort }));
});
apiRouter.post('/repertoire/songs', (req, res) => {
  if (!req.body?.title) return res.status(400).json({ error: 'title is required' });
  const saved = Store.saveRepertoireSong(req.body || {});
  Store.addTimelineEvent({ event_type: 'song_added', title: `Added song: ${saved.title}`, subtitle: saved.artist || 'Repertoire', entity_id: String(saved.id) });
  return res.status(201).json(saved);
});
apiRouter.put('/repertoire/songs/:id', (req, res) => {
  const before = Store.getRepertoireSong(req.params.id);
  if (!before) return res.status(404).json({ error: 'not found' });
  const saved = Store.saveRepertoireSong({ ...req.body, id: Number(req.params.id) });
  if (before.status !== saved.status) {
    Store.addTimelineEvent({ event_type: 'song_status_changed', title: `${saved.title}: ${saved.status.replace(/_/g, ' ')}`, subtitle: 'Song status updated', entity_id: String(saved.id) });
  }
  return res.json(saved);
});
apiRouter.delete('/repertoire/songs/:id', (req, res) => {
  Store.deleteRepertoireSong(req.params.id);
  return res.json({ ok: true });
});
apiRouter.delete('/songs/:id', (req, res) => {
  Store.deleteRepertoireSong(req.params.id);
  return res.json({ ok: true });
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



apiRouter.post('/training/videos/metadata', async (req, res) => {
  const rawUrl = String(req.body?.url || '').trim();
  if (!rawUrl) return res.status(400).json({ error: 'url is required' });
  try {
    const meta = await fetchYoutubeMetadata(rawUrl);
    return res.json(meta);
  } catch (error) {
    if (error?.missingBinary) return res.status(501).json({ error: 'Metadata fetch not available' });
    const message = String(error?.message || 'failed to fetch metadata').toLowerCase();
    if (message.includes('only valid youtube urls are supported')) return res.status(400).json({ error: 'only valid youtube URLs are supported' });
    return res.json({
      title: '',
      thumbnail_url: '',
      duration_seconds: null,
      source: 'youtube',
      uploader: '',
      webpage_url: '',
    });
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

  const dur = Number(payload.duration_seconds);
  const missingDuration = payload.duration_seconds == null || payload.duration_seconds === '' || !Number.isFinite(dur) || dur <= 0;

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
  const before = Store.getTrainingVideoProgress(req.params.id) || {};
  const payload = req.body || {};
  const changes = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'watched')) changes.watched = Boolean(payload.watched);
  if (Object.prototype.hasOwnProperty.call(payload, 'mastered')) changes.mastered = Boolean(payload.mastered);
  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) changes.notes = String(payload.notes ?? '');
  const saved = Store.saveTrainingVideoProgress(req.params.id, changes);
  if (!Number(before.mastered_at) && Number(saved.mastered_at)) evaluateBadges();
  return res.json(saved);
});

apiRouter.post('/training-videos', async (req, res) => {
  const payload = req.body || {};
  const videoId = payload.videoId || payload.video_id || extractYouTubeId(payload.youtube_url || payload.url);
  const youtubeUrl = payload.youtube_url || payload.url;
  if (!youtubeUrl) return res.status(400).json({ error: 'url is required' });
  if (!videoId) return res.status(400).json({ error: 'valid youtube videoId is required' });
  const dur = Number(payload.duration_seconds);
  const missingDuration =
    payload.duration_seconds == null ||
    payload.duration_seconds === '' ||
    !Number.isFinite(dur) ||
    dur <= 0;

  if (!payload.title || !(payload.thumbUrl || payload.thumb_url || payload.thumbnail_url) || missingDuration) {
    try {
      const meta = await fetchYoutubeMetadata(youtubeUrl || `https://www.youtube.com/watch?v=${videoId}`);
      payload.title = payload.title || meta.title || '';
      payload.thumbUrl =
        payload.thumbUrl ||
        payload.thumb_url ||
        payload.thumbnail_url ||
        meta.thumbnail_url ||
        '';
      if (missingDuration) {
        payload.duration_seconds = meta.duration_seconds;
      }
    } catch {}
  }
const saved = Store.saveTrainingVideo({ ...payload, source_type: 'youtube', provider: payload.provider || 'youtube', videoId, youtube_url: youtubeUrl, url: youtubeUrl, thumbnail_url: payload.thumbnail_url || payload.thumbUrl || payload.thumb_url || '' });
  return res.status(201).json(saved);
});

apiRouter.put('/training-videos/:id', async (req, res) => {
  const existing = Store.getTrainingVideo(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const payload = req.body || {};
  const dur = Number(payload.duration_seconds);
  const missingDuration =
    payload.duration_seconds == null ||
    payload.duration_seconds === '' ||
    !Number.isFinite(dur) ||
    dur <= 0;

  const videoId = payload.videoId || payload.video_id || extractYouTubeId(payload.youtube_url || payload.url || existing.youtube_url || existing.url) || existing.videoId;
  if (!videoId) return res.status(400).json({ error: 'valid youtube videoId is required' });
  if (
    (!payload.title && !existing.title) ||
    (!(payload.thumbUrl || payload.thumb_url || payload.thumbnail_url) && !(existing.thumbUrl || existing.thumb_url || existing.thumbnail_url)) ||
    missingDuration
  ) {
    try {
      const meta = await fetchYoutubeMetadata(payload.youtube_url || payload.url || existing.youtube_url || existing.url || `https://www.youtube.com/watch?v=${videoId}`);
      payload.title = payload.title || existing.title || meta.title || '';
      payload.thumbUrl = payload.thumbUrl || payload.thumb_url || payload.thumbnail_url || existing.thumbUrl || existing.thumb_url || existing.thumbnail_url || meta.thumbnail_url || '';
      if (missingDuration) {
        payload.duration_seconds = meta.duration_seconds;
      }
    } catch {}
  }
  const saved = Store.saveTrainingVideo({ ...existing, ...payload, id: Number(req.params.id), source_type: 'youtube', youtube_url: payload.youtube_url || payload.url || existing.youtube_url || existing.url || '', url: payload.youtube_url || payload.url || existing.youtube_url || existing.url || '', videoId, provider: payload.provider || existing.provider || 'youtube', thumbnail_url: payload.thumbnail_url || payload.thumbUrl || payload.thumb_url || existing.thumbnail_url || '' });
  return res.json(saved);
});

apiRouter.delete('/training-videos/:id', (req, res) => {
  const existing = Store.getTrainingVideo(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

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
  const scopeRaw = String(req.query.scope || 'all').toLowerCase();
  const scope = scopeRaw === 'top' || scopeRaw === 'nested' ? scopeRaw : 'all';
  const q = String(req.query.q || '').trim();
  const playlists = Store.listVideoPlaylists({ scope, q });
  const rollupCounts = Store.getVideoPlaylistRollupCounts(playlists.map((playlist) => playlist.id));
  const payload = playlists.map((playlist) => {
    const items = Store.listPlaylistItems(playlist.id);
    const rollupCount = Number(rollupCounts[Number(playlist.id)]) || 0;
    const deepStats = Store.getPlaylistStatsDeep(playlist.id);
    return {
      ...playlist,
      is_nested: Number(playlist.is_nested) ? 1 : 0,
      items,
      video_count_rollup: rollupCount,
      video_count: rollupCount,
      totalVideoCount: rollupCount,
      deepDurationSeconds: Number(deepStats.deepDurationSeconds) || 0,
      unknownDurationCount: Number(deepStats.unknownDurationCount) || 0,
    };
  });
  return res.json(payload);
});

apiRouter.get('/video-playlist-groups', (req, res) => {
  return res.json(Store.listPlaylistGroups());
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

apiRouter.patch('/training/playlists/:id', (req, res) => {
  const existing = Store.getVideoPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const allowedTypes = new Set(['Skill', 'Song', 'Course', 'General']);
  const type = req.body?.playlist_type || req.body?.type || existing.playlist_type || 'General';
  const payload = {
    ...existing,
    ...req.body,
    id: Number(req.params.id),
    playlist_type: allowedTypes.has(type) ? type : 'General',
  };
  const saved = Store.saveVideoPlaylist(payload);
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
  try {
    Store.replacePlaylistItems(req.params.id, items);
    return res.json(playlistWithItems(req.params.id));
  } catch (error) {
    return res.status(400).json({ error: error.message || 'unable to update items' });
  }
});

apiRouter.get('/training/playlists/video-assignments', (req, res) => {
  return res.json(Store.listVideoPlaylistAssignments());
});

apiRouter.post('/training/playlists/:id/items', (req, res) => {
  const existing = Store.getVideoPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const parentId = Number(req.params.id);
  const item = req.body || {};
  const itemType = String(item.item_type || 'video');
  if (itemType !== 'video' && itemType !== 'playlist') return res.status(400).json({ error: 'invalid item_type' });
  if (itemType === 'playlist' && !Number(item.child_playlist_id || item.childPlaylistId)) {
    return res.status(400).json({ error: 'child_playlist_id is required for item_type=playlist' });
  }
  if (itemType === 'video' && !Number(item.video_id || item.videoId)) {
    return res.status(400).json({ error: 'video_id is required for item_type=video' });
  }

  if (itemType === 'playlist') {
    const childPlaylistId = Number(item.child_playlist_id || item.childPlaylistId);
    const parentParentId = Store.getParentPlaylistId(parentId);
    if (parentParentId != null) {
      return res.status(409).json({ error: 'Cannot nest playlists inside a nested playlist. Only top-level playlists can contain playlists.' });
    }
    if (!Store.getVideoPlaylist(childPlaylistId)) {
      return res.status(400).json({ error: 'child playlist not found' });
    }
    if (childPlaylistId === parentId) {
      return res.status(400).json({ error: 'Playlist cannot contain itself' });
    }
    if (Store.wouldCreateCycle(parentId, childPlaylistId)) {
      return res.status(400).json({ error: 'Adding this playlist would create a cycle' });
    }
    const existingParent = Store.getParentPlaylistId(childPlaylistId);
    if (existingParent && existingParent !== parentId) {
      return res.status(409).json({ error: 'Playlist already nested in another playlist', parent_playlist_id: Number(existingParent) || null });
    }
    if (existingParent === parentId) {
      return res.status(409).json({ error: 'Playlist already nested in this playlist', parent_playlist_id: Number(existingParent) || null });
    }
  }

  const requestedOrder = Number(item.order_index);
  const normalizedItem = {
    ...item,
    item_type: itemType,
    order_index: Number.isFinite(requestedOrder) ? requestedOrder : 0,
  };
  try {
    Store.addPlaylistItem(req.params.id, normalizedItem);
    const refreshed = playlistWithItems(req.params.id);
    return res.status(201).json({ ok: true, items: refreshed?.items || [] });
  } catch (error) {
    if (error?.code === 'VIDEO_ALREADY_ASSIGNED') {
      return res.status(409).json({ error: 'Video already assigned to another playlist', playlist_id: Number(error.playlistId) || null });
    }
    if (error?.code === 'PLAYLIST_ALREADY_NESTED') {
      return res.status(409).json({ error: error.message || 'Playlist already nested in another playlist', parent_playlist_id: Number(error.parentPlaylistId) || null });
    }
    if (error?.code === 'PARENT_PLAYLIST_NOT_TOP_LEVEL') {
      return res.status(409).json({ error: error.message || 'Cannot nest playlists inside a nested playlist. Only top-level playlists can contain playlists.' });
    }
    return res.status(400).json({ error: error.message || 'unable to add item' });
  }
});

apiRouter.post('/training/playlists/:id/unnest', (req, res) => {
  const parent = Store.getVideoPlaylist(req.params.id);
  if (!parent) return res.status(404).json({ error: 'not found' });
  const childPlaylistId = Number(req.body?.child_playlist_id || req.body?.childPlaylistId);
  if (!childPlaylistId) return res.status(400).json({ error: 'child_playlist_id is required' });
  const child = Store.getVideoPlaylist(childPlaylistId);
  if (!child) return res.status(404).json({ error: 'child playlist not found' });
  const existingParentId = Store.getParentPlaylistId(childPlaylistId);
  if (!existingParentId) return res.status(400).json({ error: 'Playlist is already top-level' });
  if (existingParentId !== Number(req.params.id)) {
    return res.status(409).json({ error: 'Playlist is nested under a different parent', parent_playlist_id: Number(existingParentId) || null });
  }
  Store.unnestPlaylist(childPlaylistId);
  return res.json({ ok: true, child_playlist_id: childPlaylistId });
});

apiRouter.get('/training/playlists/:id', (req, res) => {
  const playlist = playlistWithItems(req.params.id);
  if (!playlist) return res.status(404).json({ error: 'not found' });
  return res.json(playlist);
});

apiRouter.delete('/training/playlists/:id/items/:itemId', (req, res) => {
  const existing = Store.getVideoPlaylist(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  Store.deletePlaylistItem(req.params.id, req.params.itemId);
  const refreshed = playlistWithItems(req.params.id);
  return res.json({ ok: true, items: refreshed?.items || [] });
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
  withBackupLock(async () => {
    const { stageRoot } = await buildBackupStagingDir();
    try {
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
      await zipStagingToResponse(stageRoot, res, `faithfulfret-backup-${stamp}.zip`);
    } finally {
      fs.rmSync(stageRoot, { recursive: true, force: true });
    }
  }).catch((error) => {
    if (!res.headersSent) res.status(500).json({ error: error.message || 'failed to export backup' });
  });
});

apiRouter.get('/export/zip', (req, res, next) => {
  req.url = '/backup/export';
  return apiRouter.handle(req, res, next);
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

const handleBackupImport = async (req, res) => {
  if (!req.file?.buffer?.length) {
    try {
      const payload = req.body || {};
      const counts = restoreFromPayload(payload);
      return res.json({ ok: true, counts, schemaVersion: payload.schemaVersion || 1, localSettings: payload.localSettings || {} });
    } catch (e) {
      return res.status(400).json({ error: e.message || 'invalid import payload' });
    }
  }

  const stamp = backupStamp();
  const importRoot = path.join('/data/_import_tmp', stamp);
  const extractRoot = path.join(importRoot, 'extract');
  const snapshotRoot = path.join(restoreBackupDir, stamp);
  mkdirIfMissing(extractRoot);

  await withBackupLock(async () => {
    isMaintenanceMode = true;
    try {
      const zip = await JSZip.loadAsync(req.file.buffer);
      const files = Object.values(zip.files);
      for (const file of files) {
        if (file.dir) continue;
        const rel = file.name.replace(/^\/+/, '');
        const outPath = path.join(extractRoot, rel);
        if (!outPath.startsWith(extractRoot)) throw new Error('invalid zip path');
        mkdirIfMissing(path.dirname(outPath));
        fs.writeFileSync(outPath, await file.async('nodebuffer'));
      }

      const manifestPath = path.join(extractRoot, 'manifest.json');
      if (!fs.existsSync(manifestPath)) throw new Error('manifest.json is required');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const sqlitePath = path.join(extractRoot, manifest.sqliteFileName || 'faithfulfret.sqlite');
      if (!fs.existsSync(sqlitePath)) throw new Error('sqlite file missing from backup');
      verifyManifestChecksums(extractRoot, manifest);

      createRestoreSnapshot(snapshotRoot);
      let rollbackOk = false;
      try {
        applyImportedStage(extractRoot, manifest);
        rollbackOk = true;
      } catch (error) {
        applySnapshot(snapshotRoot);
        throw new Error(`${error.message}. rollback applied from ${stamp}`);
      }

      return res.json({ ok: true, restoredAt: new Date().toISOString(), rollbackReady: rollbackOk, dbInfo: Store.getDbInfo() });
    } finally {
      isMaintenanceMode = false;
      fs.rmSync(importRoot, { recursive: true, force: true });
    }
  }).catch((error) => {
    if (!res.headersSent) res.status(400).json({ error: error.message || 'failed to import backup zip' });
  });
};

apiRouter.post('/backup/import', upload.single('backupZip'), handleBackupImport);



apiRouter.post('/import/zip', upload.single('backupZip'), handleBackupImport);

apiRouter.post('/backup/restore-last', async (req, res) => {
  const dirs = fs.existsSync(restoreBackupDir)
    ? fs.readdirSync(restoreBackupDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    : [];
  const latest = dirs[dirs.length - 1];
  if (!latest) return res.status(404).json({ error: 'no restore snapshot available' });
  const snapshotPath = path.join(restoreBackupDir, latest);
  await withBackupLock(async () => {
    isMaintenanceMode = true;
    try {
      applySnapshot(snapshotPath);
      res.json({ ok: true, restoredSnapshot: latest, dbInfo: Store.getDbInfo() });
    } finally {
      isMaintenanceMode = false;
    }
  }).catch((error) => {
    if (!res.headersSent) res.status(500).json({ error: error.message || 'failed to restore snapshot' });
  });
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
  console.error('[API ERROR]', req.method, req.originalUrl, err && err.stack ? err.stack : err);
  return res.status(400).json({ error: err.message || 'request failed' });
});

app.use('/api', apiRouter);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.use('/media/presets', express.static(presetMediaDir));
app.use('/media/gear', express.static(gearMediaDir));
app.use('/uploads', express.static('/data/uploads', { maxAge: 0 }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  const hasFileExtension = /\.[a-z0-9]+$/i.test(req.path);
  const looksLikeAssetPath = /^(\/img\/|\/css\/|\/js\/|\/textures\/)/i.test(req.path);
  if (hasFileExtension || looksLikeAssetPath) {
    return res.status(404).send('Not Found');
  }
  return next();
});

// SPA fallback — return index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Daily Fret running on port ${PORT}`);
});

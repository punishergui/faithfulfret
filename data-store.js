const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = '/data';
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'faithfulfret.sqlite');
console.log(`DB: ${dbPath}`);
const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT,
  durationMinutes INTEGER,
  youtubeId TEXT,
  focusTag TEXT,
  notes TEXT,
  createdAt INTEGER NOT NULL,
  bpm INTEGER,
  dayNumber INTEGER,
  focus TEXT,
  mood TEXT,
  win TEXT,
  checklist TEXT,
  links TEXT,
  videoId TEXT
);
CREATE TABLE IF NOT EXISTS gear_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  status TEXT,
  pricePaid REAL,
  priceSold REAL,
  vendor TEXT,
  links TEXT,
  notes TEXT,
  createdAt INTEGER NOT NULL,
  category TEXT,
  brand TEXT,
  model TEXT,
  price REAL,
  dateAcquired TEXT,
  buyUrl TEXT,
  mfrUrl TEXT,
  manualUrl TEXT,
  imageData TEXT
);
CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ampModel TEXT,
  settings TEXT,
  tags TEXT,
  createdAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  title TEXT,
  url TEXT,
  category TEXT,
  rating INTEGER,
  notes TEXT,
  createdAt INTEGER NOT NULL
);
`);

const uid = () => `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const n = (v) => (v == null || v === '' ? null : Number(v));

function coerceSession(input = {}) {
  return {
    id: input.id || uid(),
    date: input.date,
    title: input.title || input.focus || '',
    durationMinutes: n(input.durationMinutes ?? input.minutes),
    youtubeId: input.youtubeId || input.videoId || '',
    focusTag: input.focusTag || input.focus || '',
    notes: input.notes || '',
    createdAt: Number(input.createdAt) || Date.now(),
    bpm: n(input.bpm),
    dayNumber: n(input.dayNumber),
    focus: input.focus || input.focusTag || '',
    mood: input.mood || '',
    win: input.win || '',
    checklist: input.checklist || '',
    links: input.links || '',
    videoId: input.videoId || input.youtubeId || '',
  };
}
function coerceGear(input = {}) {
  return {
    id: input.id || uid(),
    name: input.name,
    type: input.type || input.category || '',
    status: input.status || 'owned',
    pricePaid: n(input.pricePaid ?? input.price),
    priceSold: n(input.priceSold),
    vendor: input.vendor || '',
    links: input.links || '',
    notes: input.notes || '',
    createdAt: Number(input.createdAt) || Date.now(),
    category: input.category || input.type || '',
    brand: input.brand || '',
    model: input.model || '',
    price: n(input.price ?? input.pricePaid),
    dateAcquired: input.dateAcquired || '',
    buyUrl: input.buyUrl || '',
    mfrUrl: input.mfrUrl || '',
    manualUrl: input.manualUrl || '',
    imageData: input.imageData || null,
  };
}
function coercePreset(input = {}) {
  let settings = input.settings;
  if (settings && typeof settings !== 'string') settings = JSON.stringify(settings);
  return {
    id: input.id || uid(),
    name: input.name,
    ampModel: input.ampModel || '',
    settings: settings || '{}',
    tags: Array.isArray(input.tags) ? input.tags.join(',') : (input.tags || ''),
    createdAt: Number(input.createdAt) || Date.now(),
  };
}
function coerceResource(input = {}) {
  return {
    id: input.id || uid(),
    title: input.title || '',
    url: input.url || '',
    category: input.category || '',
    rating: n(input.rating) || 0,
    notes: input.notes || '',
    createdAt: Number(input.createdAt) || Date.now(),
  };
}

const Q = {
  upsertSession: db.prepare(`INSERT INTO sessions (id,date,title,durationMinutes,youtubeId,focusTag,notes,createdAt,bpm,dayNumber,focus,mood,win,checklist,links,videoId)
    VALUES (:id,:date,:title,:durationMinutes,:youtubeId,:focusTag,:notes,:createdAt,:bpm,:dayNumber,:focus,:mood,:win,:checklist,:links,:videoId)
    ON CONFLICT(id) DO UPDATE SET
      date=excluded.date,title=excluded.title,durationMinutes=excluded.durationMinutes,youtubeId=excluded.youtubeId,focusTag=excluded.focusTag,
      notes=excluded.notes,bpm=excluded.bpm,dayNumber=excluded.dayNumber,focus=excluded.focus,mood=excluded.mood,win=excluded.win,
      checklist=excluded.checklist,links=excluded.links,videoId=excluded.videoId`),
  upsertGear: db.prepare(`INSERT INTO gear_items (id,name,type,status,pricePaid,priceSold,vendor,links,notes,createdAt,category,brand,model,price,dateAcquired,buyUrl,mfrUrl,manualUrl,imageData)
    VALUES (:id,:name,:type,:status,:pricePaid,:priceSold,:vendor,:links,:notes,:createdAt,:category,:brand,:model,:price,:dateAcquired,:buyUrl,:mfrUrl,:manualUrl,:imageData)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,type=excluded.type,status=excluded.status,pricePaid=excluded.pricePaid,priceSold=excluded.priceSold,vendor=excluded.vendor,
      links=excluded.links,notes=excluded.notes,category=excluded.category,brand=excluded.brand,model=excluded.model,price=excluded.price,
      dateAcquired=excluded.dateAcquired,buyUrl=excluded.buyUrl,mfrUrl=excluded.mfrUrl,manualUrl=excluded.manualUrl,imageData=excluded.imageData`),
  upsertPreset: db.prepare(`INSERT INTO presets (id,name,ampModel,settings,tags,createdAt)
    VALUES (:id,:name,:ampModel,:settings,:tags,:createdAt)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,ampModel=excluded.ampModel,settings=excluded.settings,tags=excluded.tags`),
  upsertResource: db.prepare(`INSERT INTO resources (id,title,url,category,rating,notes,createdAt)
    VALUES (:id,:title,:url,:category,:rating,:notes,:createdAt)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=excluded.url,category=excluded.category,rating=excluded.rating,notes=excluded.notes`),
};

const all = (sql) => db.prepare(sql).all();
const one = (sql, v) => db.prepare(sql).get(v);
const run = (sql, v) => db.prepare(sql).run(v);

const listSessions = () => all('SELECT * FROM sessions ORDER BY date DESC, createdAt DESC');

const listSessionDailyTotals = () => all(`
  SELECT
    s1.date AS date,
    COALESCE(SUM(COALESCE(s1.durationMinutes, 0)), 0) AS totalMinutes,
    COUNT(*) AS sessionCount,
    (
      SELECT s2.id
      FROM sessions s2
      WHERE s2.date = s1.date
      ORDER BY s2.createdAt DESC
      LIMIT 1
    ) AS sessionId
  FROM sessions s1
  WHERE s1.date IS NOT NULL
  GROUP BY s1.date
  ORDER BY s1.date DESC
`);
const getSession = (id) => one('SELECT * FROM sessions WHERE id = ?', id);
const saveSession = (data) => { const row = coerceSession(data); Q.upsertSession.run(row); return getSession(row.id); };
const deleteSession = (id) => run('DELETE FROM sessions WHERE id = ?', id);

const listGear = () => all('SELECT * FROM gear_items ORDER BY createdAt DESC');
const getGear = (id) => one('SELECT * FROM gear_items WHERE id = ?', id);
const saveGear = (data) => { const row = coerceGear(data); Q.upsertGear.run(row); return getGear(row.id); };
const deleteGear = (id) => run('DELETE FROM gear_items WHERE id = ?', id);

const listPresets = () => all('SELECT * FROM presets ORDER BY createdAt DESC');
const getPreset = (id) => one('SELECT * FROM presets WHERE id = ?', id);
const savePreset = (data) => { const row = coercePreset(data); Q.upsertPreset.run(row); return getPreset(row.id); };
const deletePreset = (id) => run('DELETE FROM presets WHERE id = ?', id);

const listResources = () => all('SELECT * FROM resources ORDER BY rating DESC, createdAt DESC');
const getResource = (id) => one('SELECT * FROM resources WHERE id = ?', id);
const saveResource = (data) => { const row = coerceResource(data); Q.upsertResource.run(row); return getResource(row.id); };
const deleteResource = (id) => run('DELETE FROM resources WHERE id = ?', id);

const clearAll = () => db.exec('DELETE FROM sessions; DELETE FROM gear_items; DELETE FROM resources; DELETE FROM presets;');

module.exports = { dbPath, listSessions, listSessionDailyTotals, getSession, saveSession, deleteSession, listGear, getGear, saveGear, deleteGear, listPresets, getPreset, savePreset, deletePreset, listResources, getResource, saveResource, deleteResource, clearAll };

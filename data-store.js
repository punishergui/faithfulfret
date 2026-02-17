const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = '/data';
const dbPath = path.join(dataDir, 'faithfulfret.sqlite');

function isDataMountPresent() {
  try {
    const mountInfo = fs.readFileSync('/proc/self/mountinfo', 'utf8');
    return mountInfo.split('\n').some((line) => {
      const parts = line.trim().split(' ');
      return parts[4] === dataDir;
    });
  } catch (error) {
    return false;
  }
}

const requireDataMount = String(process.env.REQUIRE_DATA_MOUNT || '').toLowerCase() === 'true';
const hasDataMount = isDataMountPresent();
if (!hasDataMount) {
  const warning = `[DB SAFETY] /data is not a mounted volume. Persistence may be lost.`;
  if (requireDataMount) throw new Error(`${warning} Refusing startup because REQUIRE_DATA_MOUNT=true.`);
  console.warn(warning);
}
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
console.log(`DB: ${dbPath}`);
let db = null;
let Q;

function openDb() {
  db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  if (typeof initQueries === 'function') initQueries();
  return db;
}

function assertQueriesInitialized() {
  if (!Q || typeof Q !== 'object') {
    throw new Error('Query preparation failed: Q is undefined. Ensure Q is declared before initQueries() runs.');
  }
}

openDb();

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
  primaryUrl TEXT,
  mfrUrl TEXT,
  manualUrl TEXT,
  imageData TEXT
);
CREATE TABLE IF NOT EXISTS gear_links (
  id TEXT PRIMARY KEY,
  gearId TEXT NOT NULL,
  label TEXT,
  url TEXT,
  price REAL,
  lastChecked TEXT,
  note TEXT,
  isPrimary INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS gear_images (
  id TEXT PRIMARY KEY,
  gearId TEXT NOT NULL,
  filePath TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  sortOrder INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS session_gear (
  sessionId TEXT NOT NULL,
  gearId TEXT NOT NULL,
  PRIMARY KEY (sessionId, gearId)
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

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('gear_items', 'boughtDate', 'TEXT');
ensureColumn('gear_items', 'boughtPrice', 'REAL');
ensureColumn('gear_items', 'boughtFrom', 'TEXT');
ensureColumn('gear_items', 'tax', 'REAL');
ensureColumn('gear_items', 'shipping', 'REAL');
ensureColumn('gear_items', 'soldDate', 'TEXT');
ensureColumn('gear_items', 'soldPrice', 'REAL');
ensureColumn('gear_items', 'soldFees', 'REAL');
ensureColumn('gear_items', 'soldWhere', 'TEXT');
ensureColumn('gear_items', 'soldShipping', 'REAL');
ensureColumn('gear_items', 'targetPrice', 'REAL');
ensureColumn('gear_items', 'priority', 'TEXT');
ensureColumn('gear_items', 'desiredCondition', 'TEXT');
ensureColumn('gear_items', 'primaryUrl', 'TEXT');
ensureColumn('gear_links', 'isPrimary', 'INTEGER DEFAULT 0');

const LEGACY_PRIMARY_KEY = 'primary';
const readPrimaryFlag = (row = {}) => Number(row.isPrimary ?? row[LEGACY_PRIMARY_KEY]) ? 1 : 0;

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
  const statusMap = {
    'Own it': 'Owned',
    owned: 'Owned',
    'Wish List': 'Wishlist',
    wishlist: 'Wishlist',
    watching: 'Wishlist',
    'On Loan': 'Wishlist',
    sold: 'Sold',
  };
  const nextStatus = statusMap[input.status] || input.status || 'Owned';
  return {
    id: input.id || uid(),
    name: input.name,
    type: input.type || input.category || '',
    status: nextStatus,
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
    primaryUrl: input.primaryUrl || input.primaryLink || input.primary || input.buyUrl || '',
    buyUrl: input.buyUrl || input.primaryUrl || input.primaryLink || input.primary || '',
    mfrUrl: input.mfrUrl || '',
    manualUrl: input.manualUrl || '',
    imageData: input.imageData || null,
    boughtDate: input.boughtDate || input.dateAcquired || '',
    boughtPrice: n(input.boughtPrice ?? input.pricePaid ?? input.price),
    boughtFrom: input.boughtFrom || input.vendor || '',
    tax: n(input.tax),
    shipping: n(input.shipping),
    soldDate: input.soldDate || '',
    soldPrice: n(input.soldPrice ?? input.priceSold),
    soldFees: n(input.soldFees),
    soldWhere: input.soldWhere || '',
    soldShipping: n(input.soldShipping),
    targetPrice: n(input.targetPrice),
    priority: input.priority || '',
    desiredCondition: input.desiredCondition || '',
  };
}

function coerceGearLink(input = {}) {
  return {
    id: input.id || uid(),
    gearId: input.gearId,
    label: input.label || '',
    url: input.url || '',
    price: n(input.price),
    lastChecked: input.lastChecked || '',
    note: input.note || '',
    isPrimary: readPrimaryFlag(input),
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

function initQueries() {
Q = {
  upsertSession: db.prepare(`INSERT INTO sessions (id,date,title,durationMinutes,youtubeId,focusTag,notes,createdAt,bpm,dayNumber,focus,mood,win,checklist,links,videoId)
    VALUES (:id,:date,:title,:durationMinutes,:youtubeId,:focusTag,:notes,:createdAt,:bpm,:dayNumber,:focus,:mood,:win,:checklist,:links,:videoId)
    ON CONFLICT(id) DO UPDATE SET
      date=excluded.date,title=excluded.title,durationMinutes=excluded.durationMinutes,youtubeId=excluded.youtubeId,focusTag=excluded.focusTag,
      notes=excluded.notes,bpm=excluded.bpm,dayNumber=excluded.dayNumber,focus=excluded.focus,mood=excluded.mood,win=excluded.win,
      checklist=excluded.checklist,links=excluded.links,videoId=excluded.videoId`),
  upsertGear: db.prepare(`INSERT INTO gear_items (id,name,type,status,pricePaid,priceSold,vendor,links,notes,createdAt,category,brand,model,price,dateAcquired,buyUrl,primaryUrl,mfrUrl,manualUrl,imageData,boughtDate,boughtPrice,boughtFrom,tax,shipping,soldDate,soldPrice,soldFees,soldWhere,soldShipping,targetPrice,priority,desiredCondition)
    VALUES (:id,:name,:type,:status,:pricePaid,:priceSold,:vendor,:links,:notes,:createdAt,:category,:brand,:model,:price,:dateAcquired,:buyUrl,:primaryUrl,:mfrUrl,:manualUrl,:imageData,:boughtDate,:boughtPrice,:boughtFrom,:tax,:shipping,:soldDate,:soldPrice,:soldFees,:soldWhere,:soldShipping,:targetPrice,:priority,:desiredCondition)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,type=excluded.type,status=excluded.status,pricePaid=excluded.pricePaid,priceSold=excluded.priceSold,vendor=excluded.vendor,
      links=excluded.links,notes=excluded.notes,category=excluded.category,brand=excluded.brand,model=excluded.model,price=excluded.price,
      dateAcquired=excluded.dateAcquired,buyUrl=excluded.buyUrl,primaryUrl=excluded.primaryUrl,mfrUrl=excluded.mfrUrl,manualUrl=excluded.manualUrl,imageData=excluded.imageData,
      boughtDate=excluded.boughtDate,boughtPrice=excluded.boughtPrice,boughtFrom=excluded.boughtFrom,tax=excluded.tax,shipping=excluded.shipping,
      soldDate=excluded.soldDate,soldPrice=excluded.soldPrice,soldFees=excluded.soldFees,soldWhere=excluded.soldWhere,soldShipping=excluded.soldShipping,
      targetPrice=excluded.targetPrice,priority=excluded.priority,desiredCondition=excluded.desiredCondition`),
  upsertGearLink: db.prepare(`INSERT INTO gear_links (id,gearId,label,url,price,lastChecked,note,isPrimary)
    VALUES (:id,:gearId,:label,:url,:price,:lastChecked,:note,:isPrimary)
    ON CONFLICT(id) DO UPDATE SET gearId=excluded.gearId,label=excluded.label,url=excluded.url,price=excluded.price,lastChecked=excluded.lastChecked,note=excluded.note,isPrimary=excluded.isPrimary`),
  upsertPreset: db.prepare(`INSERT INTO presets (id,name,ampModel,settings,tags,createdAt)
    VALUES (:id,:name,:ampModel,:settings,:tags,:createdAt)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,ampModel=excluded.ampModel,settings=excluded.settings,tags=excluded.tags`),
  upsertResource: db.prepare(`INSERT INTO resources (id,title,url,category,rating,notes,createdAt)
    VALUES (:id,:title,:url,:category,:rating,:notes,:createdAt)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=excluded.url,category=excluded.category,rating=excluded.rating,notes=excluded.notes`),
  insertGearImage: db.prepare(`INSERT INTO gear_images (id,gearId,filePath,createdAt,sortOrder)
    VALUES (:id,:gearId,:filePath,:createdAt,:sortOrder)`),
};
assertQueriesInitialized();
}

initQueries();

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
const deleteSession = (id) => {
  run('DELETE FROM session_gear WHERE sessionId = ?', id);
  return run('DELETE FROM sessions WHERE id = ?', id);
};

const listGear = (includeLinks = true) => {
  const rows = all('SELECT * FROM gear_items ORDER BY createdAt DESC');
  const imagesByGearId = listGearImagesByGearIds(rows.map((row) => row.id));
  if (!includeLinks) return rows.map((row) => ({ ...row, imagesList: imagesByGearId[row.id] || [] }));
  return rows.map((row) => ({ ...row, linksList: getGearLinks(row.id), imagesList: imagesByGearId[row.id] || [] }));
};
const getGear = (id) => one('SELECT * FROM gear_items WHERE id = ?', id);
const saveGear = (data) => { const row = coerceGear(data); Q.upsertGear.run(row); return getGear(row.id); };
const deleteGear = (id) => {
  run('DELETE FROM gear_links WHERE gearId = ?', id);
  run('DELETE FROM gear_images WHERE gearId = ?', id);
  run('DELETE FROM session_gear WHERE gearId = ?', id);
  return run('DELETE FROM gear_items WHERE id = ?', id);
};

const listGearImages = (gearId) => db.prepare('SELECT * FROM gear_images WHERE gearId = ? ORDER BY sortOrder ASC, createdAt ASC').all(gearId);
const listGearImagesByGearIds = (gearIds = []) => {
  if (!gearIds.length) return {};
  const placeholders = gearIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM gear_images WHERE gearId IN (${placeholders}) ORDER BY sortOrder ASC, createdAt ASC`).all(...gearIds);
  return rows.reduce((acc, row) => {
    if (!acc[row.gearId]) acc[row.gearId] = [];
    acc[row.gearId].push(row);
    return acc;
  }, {});
};
const addGearImage = ({ gearId, filePath, sortOrder = 0 }) => {
  const row = { id: uid(), gearId, filePath, createdAt: Date.now(), sortOrder: Number(sortOrder) || 0 };
  Q.insertGearImage.run(row);
  return row;
};
const getGearImage = (id) => one('SELECT * FROM gear_images WHERE id = ?', id);
const deleteGearImage = (id) => run('DELETE FROM gear_images WHERE id = ?', id);

const getGearLinks = (gearId) => db.prepare('SELECT * FROM gear_links WHERE gearId = ? ORDER BY isPrimary DESC, lastChecked DESC, id DESC').all(gearId).map((row) => ({ ...row, isPrimary: readPrimaryFlag(row) }));
const saveGearLink = (data) => {
  const row = coerceGearLink(data);
  if (!row.gearId) throw new Error('gearId is required');
  Q.upsertGearLink.run(row);
  return row;
};
const deleteGearLink = (id) => run('DELETE FROM gear_links WHERE id = ?', id);
const replaceGearLinks = (gearId, links = []) => {
  const tx = db.transaction((targetGearId, nextLinks) => {
    run('DELETE FROM gear_links WHERE gearId = ?', targetGearId);
    nextLinks.forEach((link) => saveGearLink({ ...link, gearId: targetGearId }));
  });
  tx(gearId, links);
  return getGearLinks(gearId);
};

const saveSessionGear = (sessionId, gearIds = []) => {
  const tx = db.transaction((targetSessionId, ids) => {
    run('DELETE FROM session_gear WHERE sessionId = ?', targetSessionId);
    const insert = db.prepare('INSERT OR IGNORE INTO session_gear (sessionId, gearId) VALUES (?, ?)');
    [...new Set(ids.filter(Boolean))].forEach((gearId) => insert.run(targetSessionId, gearId));
  });
  tx(sessionId, gearIds);
  return listSessionGear(sessionId);
};
const listSessionGear = (sessionId) => db.prepare(`
  SELECT g.*
  FROM session_gear sg
  JOIN gear_items g ON g.id = sg.gearId
  WHERE sg.sessionId = ?
  ORDER BY g.name COLLATE NOCASE ASC
`).all(sessionId);
const listSessionGearBySessionIds = (sessionIds = []) => {
  if (!sessionIds.length) return [];
  const placeholders = sessionIds.map(() => '?').join(',');
  return db.prepare(`
    SELECT sg.sessionId, g.id, g.name, g.category, g.status
    FROM session_gear sg
    JOIN gear_items g ON g.id = sg.gearId
    WHERE sg.sessionId IN (${placeholders})
    ORDER BY g.name COLLATE NOCASE ASC
  `).all(...sessionIds);
};

const getGearUsage = () => db.prepare(`
  SELECT
    sg.gearId AS gearId,
    COUNT(*) AS usedCount,
    MAX(s.date) AS lastUsed
  FROM session_gear sg
  JOIN sessions s ON s.id = sg.sessionId
  GROUP BY sg.gearId
`).all().reduce((acc, row) => {
  acc[row.gearId] = {
    usedCount: Number(row.usedCount) || 0,
    lastUsed: row.lastUsed || '',
  };
  return acc;
}, {});

const listPresets = () => all('SELECT * FROM presets ORDER BY createdAt DESC');
const getPreset = (id) => one('SELECT * FROM presets WHERE id = ?', id);
const savePreset = (data) => { const row = coercePreset(data); Q.upsertPreset.run(row); return getPreset(row.id); };
const deletePreset = (id) => run('DELETE FROM presets WHERE id = ?', id);

const listResources = () => all('SELECT * FROM resources ORDER BY rating DESC, createdAt DESC');
const getResource = (id) => one('SELECT * FROM resources WHERE id = ?', id);
const saveResource = (data) => { const row = coerceResource(data); Q.upsertResource.run(row); return getResource(row.id); };
const deleteResource = (id) => run('DELETE FROM resources WHERE id = ?', id);

const clearAll = () => db.exec('DELETE FROM session_gear; DELETE FROM gear_links; DELETE FROM gear_images; DELETE FROM sessions; DELETE FROM gear_items; DELETE FROM resources; DELETE FROM presets;');


const checkpointWal = () => db.exec('PRAGMA wal_checkpoint(FULL);');
const close = () => {
  if (!db) return;
  db.close();
  db = null;
};
const reopen = () => {
  if (db) return db;
  openDb();
  return db;
};
const backupToFile = (filePath) => {
  if (!db) reopen();
  return db.backup(filePath);
};

const getDbInfo = () => {
  const file = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
  return {
    dbPath: path.resolve(dbPath),
    sizeBytes: file?.size || 0,
    modifiedAt: file?.mtime?.toISOString() || null,
    sessions: Number(db.prepare('SELECT COUNT(*) AS count FROM sessions').get().count) || 0,
    gear: Number(db.prepare('SELECT COUNT(*) AS count FROM gear_items').get().count) || 0,
    presets: Number(db.prepare('SELECT COUNT(*) AS count FROM presets').get().count) || 0,
  };
};

const dbInfo = getDbInfo();
console.log(`[DB INFO] path=${dbInfo.dbPath} size=${dbInfo.sizeBytes} modified=${dbInfo.modifiedAt} sessions=${dbInfo.sessions} gear=${dbInfo.gear} presets=${dbInfo.presets}`);

module.exports = { dbPath, getDbInfo, listSessions, listSessionDailyTotals, getSession, saveSession, deleteSession, listGear, getGear, saveGear, deleteGear, getGearLinks, saveGearLink, deleteGearLink, replaceGearLinks, listGearImages, addGearImage, getGearImage, deleteGearImage, saveSessionGear, listSessionGear, listSessionGearBySessionIds, getGearUsage, listPresets, getPreset, savePreset, deletePreset, listResources, getResource, saveResource, deleteResource, clearAll, checkpointWal, backupToFile, close, reopen };

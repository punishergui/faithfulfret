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

const BASE_SCHEMA_SQL = `
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
  audioData TEXT,
  audioPath TEXT,
  audioMime TEXT,
  audioDuration REAL,
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
CREATE TABLE IF NOT EXISTS training_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT,
  provider TEXT,
  videoId TEXT,
  title TEXT,
  author TEXT,
  thumbUrl TEXT,
  tags TEXT,
  difficulty TEXT,
  notes TEXT,
  description_html TEXT,
  description_text TEXT,
  createdAt INTEGER,
  updatedAt INTEGER
);
CREATE TABLE IF NOT EXISTS video_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  description TEXT,
  createdAt INTEGER,
  updatedAt INTEGER
);
CREATE TABLE IF NOT EXISTS playlist_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS playlist_group_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  playlist_id INTEGER,
  order_index INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS video_playlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlistId INTEGER,
  videoId INTEGER,
  position INTEGER
);
CREATE TABLE IF NOT EXISTS video_timestamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  videoId INTEGER,
  label TEXT,
  seconds INTEGER,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  url TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  level TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  lesson_type TEXT NOT NULL DEFAULT 'core' CHECK(lesson_type IN ('core','drill','reference')),
  video_url TEXT,
  video_provider TEXT,
  video_id TEXT,
  thumb_url TEXT,
  author TEXT,
  duration_sec INTEGER,
  summary TEXT,
  practice_plan TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_skills (
  lesson_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  weight REAL DEFAULT 1,
  PRIMARY KEY (lesson_id, skill)
);
CREATE TABLE IF NOT EXISTS session_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  lesson_id INTEGER,
  type TEXT NOT NULL CHECK(type IN ('lesson','exercise','note')),
  title TEXT,
  minutes_spent INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_repeat_goals (
  lesson_id INTEGER PRIMARY KEY,
  target_repeats INTEGER,
  target_minutes INTEGER
);
CREATE TABLE IF NOT EXISTS training_playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_playlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  position INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS video_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('pdf','image','link')),
  title TEXT,
  url TEXT,
  filename TEXT,
  mime TEXT,
  size_bytes INTEGER,
  storage_path TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('lesson','video')),
  entity_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('pdf','image','file')),
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS training_video_progress (
  video_id INTEGER PRIMARY KEY,
  watched_at INTEGER,
  mastered_at INTEGER,
  notes TEXT,
  updated_at INTEGER NOT NULL
);
`;

function ensureSchema() {
  db.exec(BASE_SCHEMA_SQL);

  // gear_items column migrations (idempotent)
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
ensureColumn('presets', 'audioPath', 'TEXT');
ensureColumn('presets', 'audioMime', 'TEXT');
ensureColumn('presets', 'audioDuration', 'REAL');
ensureColumn('presets', 'audioData', 'TEXT');
ensureColumn('training_videos', 'url', 'TEXT');
ensureColumn('training_videos', 'provider', 'TEXT');
ensureColumn('training_videos', 'videoId', 'TEXT');
ensureColumn('training_videos', 'title', 'TEXT');
ensureColumn('training_videos', 'author', 'TEXT');
ensureColumn('training_videos', 'thumbUrl', 'TEXT');
ensureColumn('training_videos', 'tags', 'TEXT');
ensureColumn('training_videos', 'difficulty', 'TEXT');
ensureColumn('training_videos', 'notes', 'TEXT');
ensureColumn('training_videos', 'description_html', 'TEXT');
ensureColumn('training_videos', 'description_text', 'TEXT');
ensureColumn('training_videos', 'createdAt', 'INTEGER');
ensureColumn('training_videos', 'updatedAt', 'INTEGER');
ensureColumn('training_videos', 'category', "TEXT DEFAULT 'general' CHECK(category IN ('general','skill','song'))");
ensureColumn('training_videos', 'difficulty_track', "TEXT CHECK(difficulty_track IN ('Beginner','Intermediate','Advanced'))");
ensureColumn('training_videos', 'difficulty_level', 'INTEGER CHECK(difficulty_level IN (1,2,3))');
ensureColumn('training_videos', 'thumb_url', 'TEXT');
ensureColumn('training_videos', 'video_id', 'TEXT');
ensureColumn('training_videos', 'source_type', "TEXT NOT NULL DEFAULT 'youtube'");
ensureColumn('training_videos', 'youtube_url', 'TEXT');
ensureColumn('training_videos', 'upload_url', 'TEXT');
ensureColumn('training_videos', 'upload_mime', 'TEXT');
ensureColumn('training_videos', 'upload_size', 'INTEGER');
ensureColumn('training_videos', 'upload_original_name', 'TEXT');
ensureColumn('training_videos', 'thumbnail_url', 'TEXT');
ensureColumn('training_videos', 'local_video_path', 'TEXT');
ensureColumn('training_videos', 'thumbnail_path', 'TEXT');
ensureColumn('training_videos', 'thumbnail_updated_at', 'TEXT');
db.prepare(`UPDATE training_videos
  SET source_type = COALESCE(NULLIF(source_type, ''), 'youtube'),
      youtube_url = COALESCE(NULLIF(youtube_url, ''), NULLIF(url, '')),
      thumbnail_url = COALESCE(NULLIF(thumbnail_url, ''), NULLIF(thumb_url, ''), NULLIF(thumbUrl, ''))
  WHERE 1=1`).run();
ensureColumn('video_playlists', 'name', 'TEXT');
ensureColumn('video_playlists', 'description', 'TEXT');
ensureColumn('video_playlists', 'createdAt', 'INTEGER');
ensureColumn('video_playlists', 'updatedAt', 'INTEGER');
ensureColumn('video_playlist_items', 'playlistId', 'INTEGER');
ensureColumn('video_playlist_items', 'videoId', 'INTEGER');
ensureColumn('video_playlist_items', 'position', 'INTEGER');
ensureColumn('video_playlists', 'created_at', 'INTEGER');
ensureColumn('video_playlists', 'updated_at', 'INTEGER');
ensureColumn('video_playlists', 'sort_order', 'INTEGER DEFAULT 0');
ensureColumn('video_playlists', 'difficulty_label', 'TEXT');
ensureColumn('video_playlists', 'playlist_type', "TEXT DEFAULT 'General'");
ensureColumn('playlist_groups', 'name', 'TEXT');
ensureColumn('playlist_groups', 'description', 'TEXT');
ensureColumn('playlist_groups', 'order_index', 'INTEGER DEFAULT 0');
ensureColumn('playlist_groups', 'created_at', 'TEXT');
ensureColumn('playlist_group_items', 'group_id', 'INTEGER');
ensureColumn('playlist_group_items', 'playlist_id', 'INTEGER');
ensureColumn('playlist_group_items', 'order_index', 'INTEGER DEFAULT 0');
ensureColumn('video_playlist_items', 'playlist_id', 'INTEGER');
ensureColumn('video_playlist_items', 'video_id', 'INTEGER');
ensureColumn('video_playlist_items', 'item_type', "TEXT NOT NULL DEFAULT 'video'");
ensureColumn('video_playlist_items', 'child_playlist_id', 'INTEGER');
ensureColumn('video_playlist_items', 'order_index', 'INTEGER DEFAULT 0');
ensureColumn('video_attachments', 'video_id', 'INTEGER');
ensureColumn('video_attachments', 'kind', "TEXT CHECK(kind IN ('pdf','image','link'))");
ensureColumn('video_attachments', 'title', 'TEXT');
ensureColumn('video_attachments', 'url', 'TEXT');
ensureColumn('video_attachments', 'filename', 'TEXT');
ensureColumn('video_attachments', 'mime', 'TEXT');
ensureColumn('video_attachments', 'size_bytes', 'INTEGER');
ensureColumn('video_attachments', 'storage_path', 'TEXT');
ensureColumn('video_attachments', 'created_at', 'INTEGER');
ensureColumn('video_timestamps', 'videoId', 'INTEGER');
ensureColumn('video_timestamps', 'label', 'TEXT');
ensureColumn('video_timestamps', 'seconds', 'INTEGER');
ensureColumn('video_timestamps', 'notes', 'TEXT');
ensureColumn('sessions', 'ended_at', 'INTEGER');
ensureColumn('sessions', 'total_minutes', 'INTEGER');
ensureColumn('sessions', 'status', 'TEXT');
ensureColumn('lessons', 'notes_md', 'TEXT');
ensureColumn('lessons', 'practice_plan_md', 'TEXT');
ensureColumn('lessons', 'chords_md', 'TEXT');
ensureColumn('courses', 'level', 'INTEGER');
ensureColumn('training_video_progress', 'watched_at', 'INTEGER');
ensureColumn('training_video_progress', 'mastered_at', 'INTEGER');
ensureColumn('training_video_progress', 'notes', 'TEXT');
ensureColumn('training_video_progress', 'updated_at', 'INTEGER');

db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_modules_course_id ON modules(course_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_courses_provider_id ON courses(provider_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_session_items_lesson_id ON session_items(lesson_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_session_items_session_id ON session_items(session_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_training_playlist_items_playlist_id ON training_playlist_items(playlist_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_video_playlist_items_playlist_id ON video_playlist_items(playlist_id, playlistId)');
db.exec('CREATE INDEX IF NOT EXISTS idx_video_playlist_items_child_playlist_id ON video_playlist_items(child_playlist_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_video_attachments_video_id ON video_attachments(video_id)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_group_items_playlist ON playlist_group_items(playlist_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_playlist_group_items_group_order ON playlist_group_items(group_id, order_index)');

db.exec(`CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  track TEXT NOT NULL CHECK(track IN ('Beginner','Intermediate','Advanced')),
  level_num INTEGER NOT NULL CHECK(level_num IN (1,2,3)),
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS skill_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT,
  level_hint TEXT,
  thumb_url TEXT,
  created_at INTEGER NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS song_lessons (
  song_id INTEGER NOT NULL,
  lesson_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
)`);
ensureColumn('modules', 'level_id', 'INTEGER');
ensureColumn('modules', 'module_num', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('modules', 'thumb_url', 'TEXT');
ensureColumn('lessons', 'description', 'TEXT');
ensureColumn('lessons', 'lesson_kind', "TEXT NOT NULL DEFAULT 'lesson'");
ensureColumn('lessons', 'skill_tags', 'TEXT');
ensureColumn('lesson_skills', 'skill_id', 'INTEGER');
db.exec('CREATE INDEX IF NOT EXISTS idx_levels_provider_sort ON levels(provider_id, sort_order)');
db.exec('CREATE INDEX IF NOT EXISTS idx_modules_level_sort ON modules(level_id, sort_order)');
db.exec('CREATE INDEX IF NOT EXISTS idx_lessons_module_sort ON lessons(module_id, sort_order)');
db.exec('CREATE INDEX IF NOT EXISTS idx_lesson_skills_lesson ON lesson_skills(lesson_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_lesson_skills_skill ON lesson_skills(skill_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_skills_group_slug ON skills(group_id, slug)');
db.exec('CREATE INDEX IF NOT EXISTS idx_song_lessons_song_sort ON song_lessons(song_id, sort_order)');

}


function seedTrainingDefaults() {
  const now = Date.now();
  db.prepare(`INSERT INTO providers (name, slug, url, created_at)
    SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM providers WHERE slug = ?)`)
    .run('JustinGuitar', 'justinguitar', 'https://www.justinguitar.com', now, 'justinguitar');
  const provider = db.prepare('SELECT * FROM providers WHERE slug = ?').get('justinguitar');
  if (!provider) return;
  const defs = [
    ['Beginner',1,10],['Beginner',2,20],['Beginner',3,30],
    ['Intermediate',1,40],['Intermediate',2,50],['Intermediate',3,60],
    ['Advanced',1,70],['Advanced',2,80],['Advanced',3,90],
  ];
  defs.forEach(([track, level_num, sort_order]) => {
    const name = `${track} ${level_num}`;
    db.prepare(`INSERT INTO levels (provider_id,track,level_num,name,sort_order,created_at)
      SELECT @provider_id,@track,@level_num,@name,@sort_order,@created_at
      WHERE NOT EXISTS (SELECT 1 FROM levels WHERE provider_id=@provider_id AND track=@track AND level_num=@level_num)`)
      .run({ provider_id: provider.id, track, level_num, name, sort_order, created_at: now });
    const level = db.prepare('SELECT id FROM levels WHERE provider_id = ? AND track = ? AND level_num = ?').get(provider.id, track, level_num);
    if (level) {
      db.prepare(`INSERT INTO modules (level_id,title,description,module_num,sort_order,thumb_url,created_at,course_id,slug)
        SELECT @level_id,'Module 0','Getting Started',0,0,NULL,@created_at,0,'module-0'
        WHERE NOT EXISTS (SELECT 1 FROM modules WHERE level_id=@level_id AND module_num=0)`)
        .run({ level_id: level.id, created_at: now });
    }
  });
}

function openDb() {
  db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  ensureSchema();
  seedTrainingDefaults(db);
  if (typeof initQueries === 'function') initQueries();
  return db;
}

function assertQueriesInitialized() {
  if (!Q || typeof Q !== 'object') {
    throw new Error('Query preparation failed: Q is undefined. Ensure Q is declared before initQueries() runs.');
  }
}

openDb();

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
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
    audioData: input.audioData || null,
    audioPath: input.audioPath || null,
    audioMime: input.audioMime || null,
    audioDuration: n(input.audioDuration),
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

function stripHtmlToText(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?\>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeTrainingDescriptionHtml(input = '') {
  const raw = String(input || '');
  if (!raw.trim()) return '';
  const allowedTags = new Set(['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'a', 'span']);
  const allowedColors = new Set(['text', 'muted', 'accent', 'accent2', 'good', 'warn', 'bad']);
  const stack = [];
  const output = [];
  const tagRegex = /<[^>]*>/g;
  let lastIdx = 0;

  const decodeEntities = (value = '') => String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');

  const esc = (value = '') => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const parseAttrs = (chunk = '') => {
    const attrs = {};
    const attrRegex = /(\w[\w:-]*)\s*=\s*(["'])(.*?)\2|(\w[\w:-]*)\s*=\s*([^\s"'>]+)/g;
    let match;
    while ((match = attrRegex.exec(chunk))) {
      const name = String(match[1] || match[4] || '').toLowerCase();
      const value = decodeEntities(match[3] || match[5] || '').trim();
      attrs[name] = value;
    }
    return attrs;
  };

  let match;
  while ((match = tagRegex.exec(raw))) {
    const textChunk = raw.slice(lastIdx, match.index);
    if (textChunk) output.push(esc(decodeEntities(textChunk)));
    lastIdx = tagRegex.lastIndex;

    const token = match[0];
    if (/^<!--/.test(token)) continue;
    const tagMatch = token.match(/^<\s*(\/)?\s*([a-z0-9]+)([\s\S]*?)\/?\s*>$/i);
    if (!tagMatch) continue;
    const closing = Boolean(tagMatch[1]);
    const tag = String(tagMatch[2] || '').toLowerCase();
    const attrsChunk = String(tagMatch[3] || '');
    const selfClosing = /\/>$/.test(token) || tag === 'br' || tag === 'hr';
    if (!allowedTags.has(tag)) continue;

    if (closing) {
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) continue;
      while (stack.length > idx) {
        const closeTag = stack.pop();
        output.push(`</${closeTag}>`);
      }
      continue;
    }

    if (tag === 'a') {
      const attrs = parseAttrs(attrsChunk);
      const href = String(attrs.href || '').trim();
      if (!/^https?:\/\//i.test(href)) continue;
      output.push(`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">`);
      stack.push('a');
      continue;
    }

    if (tag === 'span') {
      const attrs = parseAttrs(attrsChunk);
      const color = String(attrs['data-color'] || '').trim();
      if (!allowedColors.has(color)) continue;
      output.push(`<span data-color="${esc(color)}">`);
      stack.push('span');
      continue;
    }

    output.push(`<${tag}>`);
    if (!selfClosing) stack.push(tag);
  }

  const tail = raw.slice(lastIdx);
  if (tail) output.push(esc(decodeEntities(tail)));
  while (stack.length) output.push(`</${stack.pop()}>`);
  return output.join('').trim();
}

function coerceTrainingVideo(input = {}) {
  const now = Date.now();
  const track = input.difficulty_track || input.difficultyTrack || input.difficulty || '';
  const levelRaw = input.difficulty_level || input.difficultyLevel || null;
  const levelNum = levelRaw == null || levelRaw === '' ? null : Number(levelRaw);
  const sourceTypeRaw = String(input.source_type || input.sourceType || '').trim().toLowerCase();
  const source_type = sourceTypeRaw === 'upload' ? 'upload' : 'youtube';
  const youtube_url = input.youtube_url || input.youtubeUrl || input.url || '';
  const upload_url = input.upload_url || input.uploadUrl || '';
  const thumbnail_url = input.thumbnail_url || input.thumbnailUrl || input.thumb_url || input.thumbUrl || '';
  return {
    id: input.id == null || input.id === '' ? null : Number(input.id),
    url: input.url || '',
    provider: input.provider || 'youtube',
    videoId: input.videoId || input.video_id || '',
    title: input.title || '',
    author: input.author || '',
    thumbUrl: thumbnail_url,
    source_type,
    youtube_url,
    upload_url,
    upload_mime: input.upload_mime || input.uploadMime || '',
    upload_size: n(input.upload_size ?? input.uploadSize),
    upload_original_name: input.upload_original_name || input.uploadOriginalName || '',
    thumbnail_url,
    tags: Array.isArray(input.tags) ? input.tags.join(',') : (input.tags || ''),
    difficulty: input.difficulty || track,
    difficulty_track: track || null,
    difficulty_level: Number.isFinite(levelNum) ? levelNum : null,
    category: input.category || 'general',
    notes: input.notes || input.description_text || '',
    description_html: sanitizeTrainingDescriptionHtml(input.description_html || ''),
    description_text: input.description_text || stripHtmlToText(input.description_html || '') || input.notes || '',
    createdAt: Number(input.createdAt) || now,
    updatedAt: Number(input.updatedAt) || now,
  };
}

function coerceVideoPlaylist(input = {}) {
  const now = Date.now();
  const sortOrder = input.sort_order == null || input.sort_order === '' ? 0 : Number(input.sort_order);
  const groupId = input.group_id == null || input.group_id === '' ? null : Number(input.group_id);
  const orderIndex = input.order_index == null || input.order_index === '' ? sortOrder : Number(input.order_index);
  return {
    id: input.id == null || input.id === '' ? null : Number(input.id),
    name: input.name || '',
    description: input.description || '',
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
    difficulty_label: input.difficulty_label || input.difficulty || '',
    playlist_type: input.playlist_type || input.type || 'General',
    group_id: Number.isFinite(groupId) ? groupId : null,
    group_name: input.group_name || '',
    createdAt: Number(input.createdAt) || now,
    updatedAt: Number(input.updatedAt) || now,
  };
}

function coerceVideoTimestamp(input = {}) {
  return {
    id: input.id == null || input.id === '' ? null : Number(input.id),
    videoId: Number(input.videoId) || null,
    label: input.label || '',
    seconds: n(input.seconds) || 0,
    notes: input.notes || '',
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
  upsertPreset: db.prepare(`INSERT INTO presets (id,name,ampModel,settings,tags,audioData,audioPath,audioMime,audioDuration,createdAt)
    VALUES (:id,:name,:ampModel,:settings,:tags,:audioData,:audioPath,:audioMime,:audioDuration,:createdAt)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,ampModel=excluded.ampModel,settings=excluded.settings,tags=excluded.tags,audioData=excluded.audioData,audioPath=excluded.audioPath,audioMime=excluded.audioMime,audioDuration=excluded.audioDuration`),
  upsertResource: db.prepare(`INSERT INTO resources (id,title,url,category,rating,notes,createdAt)
    VALUES (:id,:title,:url,:category,:rating,:notes,:createdAt)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=excluded.url,category=excluded.category,rating=excluded.rating,notes=excluded.notes`),
  insertGearImage: db.prepare(`INSERT INTO gear_images (id,gearId,filePath,createdAt,sortOrder)
    VALUES (:id,:gearId,:filePath,:createdAt,:sortOrder)`),
};
assertQueriesInitialized();
}

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

const listTrainingVideos = (filters = {}) => {
  const where = [];
  const values = [];
  if (filters.q) {
    where.push('(title LIKE ? OR author LIKE ? OR notes LIKE ? OR description_text LIKE ? OR tags LIKE ?)');
    const like = `%${String(filters.q).trim()}%`;
    values.push(like, like, like, like, like);
  }
  if (filters.tags) {
    const tags = String(filters.tags).split(',').map((tag) => tag.trim()).filter(Boolean);
    tags.forEach((tag) => {
      where.push('tags LIKE ?');
      values.push(`%${tag}%`);
    });
  }
  if (filters.category) {
    where.push("COALESCE(category, 'general') = ?");
    values.push(String(filters.category));
  }
  if (filters.difficulty_track) {
    where.push('difficulty_track = ?');
    values.push(String(filters.difficulty_track));
  }
  if (filters.difficulty_level) {
    where.push('difficulty_level = ?');
    values.push(Number(filters.difficulty_level));
  }
  if (filters.playlistId) {
    where.push('id IN (SELECT COALESCE(video_id, videoId) FROM video_playlist_items WHERE COALESCE(playlist_id, playlistId) = ?)');
    values.push(Number(filters.playlistId));
  }
  const includeProgress = String(filters.includeProgress || '') === '1' || filters.includeProgress === true;
  const selectProgress = includeProgress
    ? `, p.watched_at, p.mastered_at,
      CASE
        WHEN p.notes IS NULL OR trim(p.notes) = '' THEN ''
        WHEN length(trim(p.notes)) <= 80 THEN trim(p.notes)
        ELSE substr(trim(p.notes), 1, 80) || '…'
      END AS notes_preview`
    : '';
  const selectAttachmentCounts = `,
      (
        SELECT COUNT(*)
        FROM video_attachments va
        WHERE va.video_id = training_videos.id
      ) AS attachment_count,
      (
        SELECT COUNT(*)
        FROM video_attachments va
        WHERE va.video_id = training_videos.id AND va.kind = 'pdf'
      ) AS pdf_attachment_count`;
  const joinProgress = includeProgress ? ' LEFT JOIN training_video_progress p ON p.video_id = training_videos.id' : '';
  const sql = `SELECT training_videos.*${selectProgress}${selectAttachmentCounts} FROM training_videos${joinProgress} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY training_videos.updatedAt DESC, training_videos.id DESC`;
  return db.prepare(sql).all(...values);
};

const getTrainingVideo = (id) => one('SELECT * FROM training_videos WHERE id = ?', Number(id));
const saveTrainingVideo = (data) => {
  const row = coerceTrainingVideo(data);
  const existing = row.id ? getTrainingVideo(row.id) : null;
  const createdAt = existing?.createdAt || row.createdAt;
  if (existing) {
    db.prepare(`UPDATE training_videos SET url=@url, provider=@provider, source_type=@source_type, youtube_url=@youtube_url, upload_url=@upload_url, upload_mime=@upload_mime, upload_size=@upload_size, upload_original_name=@upload_original_name, thumbnail_url=@thumbnail_url, videoId=@videoId, video_id=@videoId, title=@title, author=@author, thumbUrl=@thumbUrl, thumb_url=@thumbUrl, tags=@tags, difficulty=@difficulty, difficulty_track=@difficulty_track, difficulty_level=@difficulty_level, category=@category, notes=@notes, description_html=@description_html, description_text=@description_text, createdAt=@createdAt, updatedAt=@updatedAt WHERE id=@id`)
      .run({ ...row, createdAt, updatedAt: Date.now() });
    return getTrainingVideo(row.id);
  }
  const result = db.prepare(`INSERT INTO training_videos (url,provider,source_type,youtube_url,upload_url,upload_mime,upload_size,upload_original_name,thumbnail_url,videoId,video_id,title,author,thumbUrl,thumb_url,tags,difficulty,difficulty_track,difficulty_level,category,notes,description_html,description_text,createdAt,updatedAt)
    VALUES (@url,@provider,@source_type,@youtube_url,@upload_url,@upload_mime,@upload_size,@upload_original_name,@thumbnail_url,@videoId,@videoId,@title,@author,@thumbUrl,@thumbUrl,@tags,@difficulty,@difficulty_track,@difficulty_level,@category,@notes,@description_html,@description_text,@createdAt,@updatedAt)`)
    .run({ ...row, createdAt, updatedAt: Date.now() });
  return getTrainingVideo(result.lastInsertRowid);
};

const saveTrainingVideoUpload = (id, data = {}) => {
  run(`UPDATE training_videos
    SET source_type = 'upload',
        upload_url = @upload_url,
        upload_mime = @upload_mime,
        upload_size = @upload_size,
        upload_original_name = @upload_original_name,
        local_video_path = COALESCE(@local_video_path, local_video_path),
        thumbnail_path = COALESCE(@thumbnail_path, thumbnail_path),
        thumbnail_updated_at = CASE WHEN @thumbnail_url IS NULL THEN thumbnail_updated_at ELSE @thumbnail_updated_at END,
        thumbnail_url = COALESCE(@thumbnail_url, thumbnail_url),
        thumbUrl = COALESCE(@thumbnail_url, thumbnail_url, thumbUrl),
        thumb_url = COALESCE(@thumbnail_url, thumbnail_url, thumb_url),
        updatedAt = @updatedAt
    WHERE id = @id`, {
    id: Number(id),
    upload_url: data.upload_url || '',
    upload_mime: data.upload_mime || '',
    upload_size: n(data.upload_size),
    upload_original_name: data.upload_original_name || '',
    local_video_path: data.local_video_path || null,
    thumbnail_path: data.thumbnail_path || null,
    thumbnail_updated_at: data.thumbnail_url ? new Date().toISOString() : null,
    thumbnail_url: data.thumbnail_url || null,
    updatedAt: Date.now(),
  });
  return getTrainingVideo(id);
};

const saveTrainingVideoThumbnail = (id, data = {}) => {
  run(`UPDATE training_videos
    SET thumbnail_path = @thumbnail_path,
        thumbnail_url = @thumbnail_url,
        thumbUrl = @thumbnail_url,
        thumb_url = @thumbnail_url,
        thumbnail_updated_at = @thumbnail_updated_at,
        updatedAt = @updatedAt
    WHERE id = @id`, {
    id: Number(id),
    thumbnail_path: data.thumbnail_path || null,
    thumbnail_url: data.thumbnail_url || null,
    thumbnail_updated_at: new Date().toISOString(),
    updatedAt: Date.now(),
  });
  return getTrainingVideo(id);
};
const deleteTrainingVideo = (id) => {
  const tx = db.transaction((targetId) => {
    run('DELETE FROM training_video_progress WHERE video_id = ?', targetId);
    run('DELETE FROM video_timestamps WHERE videoId = ?', targetId);
    run('DELETE FROM video_playlist_items WHERE videoId = ?', targetId);
    run('DELETE FROM training_videos WHERE id = ?', targetId);
  });
  tx(Number(id));
};

function normalizeTrainingVideoProgress(row, videoId) {
  return {
    video_id: Number(videoId),
    watched_at: row?.watched_at || null,
    mastered_at: row?.mastered_at || null,
    notes: typeof row?.notes === 'string' ? row.notes : '',
    updated_at: row?.updated_at || 0,
  };
}

const getTrainingVideoProgress = (videoId) => {
  const id = Number(videoId);
  const row = one('SELECT video_id, watched_at, mastered_at, notes, updated_at FROM training_video_progress WHERE video_id = ?', id);
  return normalizeTrainingVideoProgress(row, id);
};

const saveTrainingVideoProgress = (videoId, changes = {}) => {
  const id = Number(videoId);
  const existing = getTrainingVideoProgress(id);
  const now = Date.now();
  let watchedAt = existing.watched_at;
  let masteredAt = existing.mastered_at;
  let notes = existing.notes;

  if (Object.prototype.hasOwnProperty.call(changes, 'watched')) {
    if (changes.watched) {
      watchedAt = watchedAt || now;
    } else {
      watchedAt = null;
      masteredAt = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'mastered')) {
    if (changes.mastered) {
      masteredAt = masteredAt || now;
      watchedAt = watchedAt || now;
    } else {
      masteredAt = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(changes, 'notes')) {
    notes = String(changes.notes ?? '');
  }

  db.prepare(`INSERT INTO training_video_progress (video_id, watched_at, mastered_at, notes, updated_at)
    VALUES (@video_id, @watched_at, @mastered_at, @notes, @updated_at)
    ON CONFLICT(video_id) DO UPDATE SET
      watched_at=excluded.watched_at,
      mastered_at=excluded.mastered_at,
      notes=excluded.notes,
      updated_at=excluded.updated_at`).run({
    video_id: id,
    watched_at: watchedAt,
    mastered_at: masteredAt,
    notes,
    updated_at: now,
  });

  return getTrainingVideoProgress(id);
};

const listVideoTimestamps = (videoId) => db.prepare('SELECT * FROM video_timestamps WHERE videoId = ? ORDER BY seconds ASC, id ASC').all(Number(videoId));
const saveVideoTimestamp = (data) => {
  const row = coerceVideoTimestamp(data);
  const result = db.prepare('INSERT INTO video_timestamps (videoId,label,seconds,notes) VALUES (@videoId,@label,@seconds,@notes)').run(row);
  return one('SELECT * FROM video_timestamps WHERE id = ?', result.lastInsertRowid);
};
const deleteVideoTimestamp = (id) => run('DELETE FROM video_timestamps WHERE id = ?', Number(id));

const listPlaylistGroups = () => all('SELECT * FROM playlist_groups ORDER BY COALESCE(order_index, 0) ASC, name COLLATE NOCASE ASC');

const upsertPlaylistGroupItem = (playlistId, groupId, orderIndex) => {
  if (groupId) {
    db.prepare(`INSERT INTO playlist_group_items (group_id, playlist_id, order_index)
      VALUES (@group_id, @playlist_id, @order_index)
      ON CONFLICT(playlist_id) DO UPDATE SET
        group_id=excluded.group_id,
        order_index=excluded.order_index`).run({
      group_id: Number(groupId),
      playlist_id: Number(playlistId),
      order_index: Number.isFinite(Number(orderIndex)) ? Number(orderIndex) : 0,
    });
    return;
  }
  run('DELETE FROM playlist_group_items WHERE playlist_id = ?', Number(playlistId));
};

const resolvePlaylistGroupId = (row) => {
  if (Number(row.group_id)) return Number(row.group_id);
  const name = String(row.group_name || '').trim();
  if (!name) return null;
  const existing = one('SELECT * FROM playlist_groups WHERE LOWER(name) = LOWER(?)', name);
  if (existing) return Number(existing.id);
  const result = db.prepare('INSERT INTO playlist_groups (name, description, order_index, created_at) VALUES (?,?,?,?)')
    .run(name, '', 0, String(Date.now()));
  return Number(result.lastInsertRowid);
};

const listVideoPlaylists = () => all(`
  SELECT
    p.*,
    gi.group_id,
    gi.order_index,
    g.name AS group_name,
    g.description AS group_description,
    g.order_index AS group_order_index,
    (
      SELECT COUNT(*)
      FROM video_playlist_items i
      WHERE COALESCE(i.playlist_id, i.playlistId) = p.id
    ) AS video_count,
    (
      SELECT COALESCE(v.thumbnail_url, v.thumb_url, v.thumbUrl, '')
      FROM video_playlist_items i
      JOIN training_videos v ON v.id = COALESCE(i.video_id, i.videoId)
      WHERE COALESCE(i.playlist_id, i.playlistId) = p.id
      ORDER BY COALESCE(i.position, 0) ASC, i.id ASC
      LIMIT 1
    ) AS preview_thumbnail_url
  FROM video_playlists p
  LEFT JOIN playlist_group_items gi ON gi.playlist_id = p.id
  LEFT JOIN playlist_groups g ON g.id = gi.group_id
  ORDER BY COALESCE(g.order_index, 999999) ASC, COALESCE(gi.order_index, COALESCE(p.sort_order, 0)) ASC, p.name COLLATE NOCASE ASC
`);
const getVideoPlaylist = (id) => one(`
  SELECT
    p.*,
    gi.group_id,
    gi.order_index,
    g.name AS group_name,
    g.description AS group_description,
    g.order_index AS group_order_index
  FROM video_playlists p
  LEFT JOIN playlist_group_items gi ON gi.playlist_id = p.id
  LEFT JOIN playlist_groups g ON g.id = gi.group_id
  WHERE p.id = ?
`, Number(id));
const saveVideoPlaylist = (data) => {
  const row = coerceVideoPlaylist(data);
  const existing = row.id ? getVideoPlaylist(row.id) : null;
  if (existing) {
    db.prepare('UPDATE video_playlists SET name=@name, description=@description, sort_order=@sort_order, difficulty_label=@difficulty_label, playlist_type=@playlist_type, createdAt=@createdAt, updatedAt=@updatedAt WHERE id=@id')
      .run({ ...row, createdAt: existing.createdAt || row.createdAt, updatedAt: Date.now() });
    const groupId = resolvePlaylistGroupId(row);
    upsertPlaylistGroupItem(row.id, groupId, row.order_index);
    return getVideoPlaylist(row.id);
  }
  const result = db.prepare('INSERT INTO video_playlists (name,description,sort_order,difficulty_label,playlist_type,createdAt,updatedAt) VALUES (@name,@description,@sort_order,@difficulty_label,@playlist_type,@createdAt,@updatedAt)')
    .run({ ...row, updatedAt: Date.now() });
  const groupId = resolvePlaylistGroupId(row);
  upsertPlaylistGroupItem(result.lastInsertRowid, groupId, row.order_index);
  return getVideoPlaylist(result.lastInsertRowid);
};
const deleteVideoPlaylist = (id) => {
  const tx = db.transaction((playlistId) => {
    run('DELETE FROM playlist_group_items WHERE playlist_id = ?', playlistId);
    run('DELETE FROM video_playlist_items WHERE COALESCE(playlist_id, playlistId) = ?', playlistId);
    run('DELETE FROM video_playlists WHERE id = ?', playlistId);
  });
  tx(Number(id));
};

const slugify = (value = '') => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `item-${Date.now()}`;

const listProviders = () => all('SELECT * FROM providers ORDER BY name COLLATE NOCASE ASC');
const getProvider = (id) => one('SELECT * FROM providers WHERE id = ?', Number(id));
const saveProvider = (data = {}) => {
  const now = Date.now();
  if (data.id) {
    run('UPDATE providers SET name=@name, slug=@slug, url=@url WHERE id=@id', {
      id: Number(data.id),
      name: data.name || '',
      slug: data.slug || slugify(data.name),
      url: data.url || '',
    });
    return getProvider(data.id);
  }
  const result = db.prepare('INSERT INTO providers (name,slug,url,created_at) VALUES (@name,@slug,@url,@created_at)').run({
    name: data.name || '', slug: data.slug || slugify(data.name), url: data.url || '', created_at: now,
  });
  return getProvider(result.lastInsertRowid);
};

const listCourses = (providerId) => {
  if (providerId) return db.prepare('SELECT * FROM courses WHERE provider_id = ? ORDER BY sort_order ASC, id ASC').all(Number(providerId));
  return all('SELECT * FROM courses ORDER BY sort_order ASC, id ASC');
};
const getCourse = (id) => one('SELECT * FROM courses WHERE id = ?', Number(id));
const saveCourse = (data = {}) => {
  const now = Date.now();
  const level = Number(data.level);
  const normalizedLevel = Number.isFinite(level) && level > 0 ? Math.floor(level) : null;
  if (data.id) {
    run(`UPDATE courses SET provider_id=@provider_id,title=@title,slug=@slug,description=@description,level=@level,sort_order=@sort_order WHERE id=@id`, {
      id: Number(data.id), provider_id: Number(data.provider_id), title: data.title || '', slug: data.slug || slugify(data.title), description: data.description || '', level: normalizedLevel, sort_order: Number(data.sort_order) || 0,
    });
    return getCourse(data.id);
  }
  const result = db.prepare(`INSERT INTO courses (provider_id,title,slug,description,level,sort_order,created_at) VALUES (@provider_id,@title,@slug,@description,@level,@sort_order,@created_at)`).run({
    provider_id: Number(data.provider_id), title: data.title || '', slug: data.slug || slugify(data.title), description: data.description || '', level: normalizedLevel, sort_order: Number(data.sort_order) || 0, created_at: now,
  });
  return getCourse(result.lastInsertRowid);
};

const listModules = (courseId) => {
  if (courseId) return db.prepare('SELECT * FROM modules WHERE course_id = ? ORDER BY sort_order ASC, id ASC').all(Number(courseId));
  return all('SELECT * FROM modules ORDER BY sort_order ASC, id ASC');
};
const getModule = (id) => one('SELECT * FROM modules WHERE id = ?', Number(id));
const saveModule = (data = {}) => {
  const now = Date.now();
  if (data.id) {
    run('UPDATE modules SET course_id=@course_id,title=@title,slug=@slug,description=@description,sort_order=@sort_order WHERE id=@id', {
      id: Number(data.id), course_id: Number(data.course_id), title: data.title || '', slug: data.slug || slugify(data.title), description: data.description || '', sort_order: Number(data.sort_order) || 0,
    });
    return getModule(data.id);
  }
  const result = db.prepare('INSERT INTO modules (course_id,title,slug,description,sort_order,created_at) VALUES (@course_id,@title,@slug,@description,@sort_order,@created_at)').run({
    course_id: Number(data.course_id), title: data.title || '', slug: data.slug || slugify(data.title), description: data.description || '', sort_order: Number(data.sort_order) || 0, created_at: now,
  });
  return getModule(result.lastInsertRowid);
};

const listLessons = (filters = {}) => {
  const where = [];
  const values = [];
  if (filters.moduleId) { where.push('l.module_id = ?'); values.push(Number(filters.moduleId)); }
  if (filters.type) { where.push('l.lesson_type = ?'); values.push(String(filters.type)); }
  if (filters.q) {
    where.push('(l.title LIKE ? OR l.summary LIKE ? OR l.notes LIKE ? OR l.practice_plan LIKE ?)');
    const like = `%${String(filters.q).trim()}%`;
    values.push(like, like, like, like, like);
  }
  if (filters.skill) {
    where.push('l.id IN (SELECT lesson_id FROM lesson_skills WHERE skill = ?)');
    values.push(String(filters.skill));
  }
  const sql = `SELECT l.* FROM lessons l ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY l.sort_order ASC, l.id ASC`;
  return db.prepare(sql).all(...values);
};
const getLesson = (id) => one('SELECT * FROM lessons WHERE id = ?', Number(id));
const saveLessonSkills = (lessonId, skills = []) => {
  const tx = db.transaction(() => {
    run('DELETE FROM lesson_skills WHERE lesson_id = ?', Number(lessonId));
    const insert = db.prepare('INSERT INTO lesson_skills (lesson_id,skill,weight) VALUES (?,?,?)');
    skills.forEach((item) => {
      const skill = typeof item === 'string' ? item : item?.skill;
      if (!skill) return;
      const weight = typeof item === 'object' ? Number(item.weight) || 1 : 1;
      insert.run(Number(lessonId), String(skill), weight);
    });
  });
  tx();
};
const saveLesson = (data = {}) => {
  const now = Date.now();
  if (data.id) {
    run(`UPDATE lessons SET module_id=@module_id,title=@title,slug=@slug,lesson_type=@lesson_type,video_url=@video_url,video_provider=@video_provider,video_id=@video_id,thumb_url=@thumb_url,author=@author,duration_sec=@duration_sec,summary=@summary,practice_plan=@practice_plan,notes=@notes,notes_md=@notes_md,practice_plan_md=@practice_plan_md,chords_md=@chords_md,sort_order=@sort_order,updated_at=@updated_at WHERE id=@id`, {
      id: Number(data.id), module_id: Number(data.module_id), title: data.title || '', slug: data.slug || slugify(data.title), lesson_type: data.lesson_type || 'core', video_url: data.video_url || '', video_provider: data.video_provider || '', video_id: data.video_id || '', thumb_url: data.thumb_url || '', author: data.author || '', duration_sec: Number(data.duration_sec) || 0, summary: data.summary || '', practice_plan: data.practice_plan || '', notes: data.notes || '', notes_md: data.notes_md || '', practice_plan_md: data.practice_plan_md || '', chords_md: data.chords_md || '', sort_order: Number(data.sort_order) || 0, updated_at: now,
    });
    if (Array.isArray(data.skills)) saveLessonSkills(data.id, data.skills);
    return getLesson(data.id);
  }
  const result = db.prepare(`INSERT INTO lessons (module_id,title,slug,lesson_type,video_url,video_provider,video_id,thumb_url,author,duration_sec,summary,practice_plan,notes,notes_md,practice_plan_md,chords_md,sort_order,created_at,updated_at)
    VALUES (@module_id,@title,@slug,@lesson_type,@video_url,@video_provider,@video_id,@thumb_url,@author,@duration_sec,@summary,@practice_plan,@notes,@notes_md,@practice_plan_md,@chords_md,@sort_order,@created_at,@updated_at)`).run({
    module_id: Number(data.module_id), title: data.title || '', slug: data.slug || slugify(data.title), lesson_type: data.lesson_type || 'core', video_url: data.video_url || '', video_provider: data.video_provider || '', video_id: data.video_id || '', thumb_url: data.thumb_url || '', author: data.author || '', duration_sec: Number(data.duration_sec) || 0, summary: data.summary || '', practice_plan: data.practice_plan || '', notes: data.notes || '', notes_md: data.notes_md || '', practice_plan_md: data.practice_plan_md || '', chords_md: data.chords_md || '', sort_order: Number(data.sort_order) || 0, created_at: now, updated_at: now,
  });
  if (Array.isArray(data.skills)) saveLessonSkills(result.lastInsertRowid, data.skills);
  return getLesson(result.lastInsertRowid);
};
const deleteLesson = (id) => {
  const tx = db.transaction((lessonId) => {
    run('DELETE FROM lesson_skills WHERE lesson_id = ?', lessonId);
    run('DELETE FROM attachments WHERE entity_type = ? AND entity_id = ?', 'lesson', lessonId);
    run('DELETE FROM lessons WHERE id = ?', lessonId);
  });
  tx(Number(id));
};

const createDraftSession = (data = {}) => saveSession({
  id: data.id || uid(),
  date: data.date || new Date().toISOString().slice(0, 10),
  title: data.title || 'Training Session',
  createdAt: Date.now(),
  durationMinutes: 0,
  status: 'draft',
  total_minutes: 0,
  ended_at: null,
});
const addSessionItem = (data = {}) => {
  const result = db.prepare('INSERT INTO session_items (session_id,lesson_id,type,title,minutes_spent,completed,notes,sort_order,created_at) VALUES (@session_id,@lesson_id,@type,@title,@minutes_spent,@completed,@notes,@sort_order,@created_at)').run({
    session_id: data.session_id,
    lesson_id: data.lesson_id ? Number(data.lesson_id) : null,
    type: data.type || 'lesson',
    title: data.title || '',
    minutes_spent: Number(data.minutes_spent) || 0,
    completed: Number(data.completed) ? 1 : 0,
    notes: data.notes || '',
    sort_order: Number(data.sort_order) || 0,
    created_at: Number(data.created_at) || Date.now(),
  });
  return one('SELECT * FROM session_items WHERE id = ?', result.lastInsertRowid);
};
const updateSessionItem = (id, data = {}) => {
  const existing = one('SELECT * FROM session_items WHERE id = ?', Number(id));
  if (!existing) return null;
  run('UPDATE session_items SET title=@title, minutes_spent=@minutes_spent, completed=@completed, notes=@notes, sort_order=@sort_order WHERE id=@id', {
    id: Number(id),
    title: data.title ?? existing.title,
    minutes_spent: data.minutes_spent == null ? existing.minutes_spent : Number(data.minutes_spent) || 0,
    completed: data.completed == null ? existing.completed : (Number(data.completed) ? 1 : 0),
    notes: data.notes ?? existing.notes,
    sort_order: data.sort_order == null ? existing.sort_order : Number(data.sort_order) || 0,
  });
  return one('SELECT * FROM session_items WHERE id = ?', Number(id));
};
const deleteSessionItem = (id) => run('DELETE FROM session_items WHERE id = ?', Number(id));
const listSessionItems = (sessionId) => db.prepare('SELECT * FROM session_items WHERE session_id = ? ORDER BY sort_order ASC, id ASC').all(sessionId);
const getSessionWithItems = (sessionId) => {
  const session = getSession(sessionId);
  if (!session) return null;
  return { ...session, items: listSessionItems(sessionId) };
};
const finishSession = (sessionId) => {
  const items = listSessionItems(sessionId);
  const totalMinutes = items.reduce((sum, row) => sum + (Number(row.minutes_spent) || 0), 0);
  const endedAt = Date.now();
  const existing = getSession(sessionId);
  if (!existing) return null;
  const saved = saveSession({ ...existing, id: sessionId, status: 'finished', ended_at: endedAt, total_minutes: totalMinutes, durationMinutes: totalMinutes });
  return { ...saved, items };
};

const getLessonStats = (lessonId) => one(`SELECT
  SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS times_completed,
  SUM(minutes_spent) AS total_minutes_spent,
  MIN(CASE WHEN completed = 1 THEN created_at END) AS first_completed_at,
  MAX(CASE WHEN completed = 1 THEN created_at END) AS last_completed_at
  FROM session_items
  WHERE lesson_id = ?`, Number(lessonId)) || {};

const getLessonHistory = (lessonId) => db.prepare(`
  SELECT si.*, s.date AS session_date, s.title AS session_title
  FROM session_items si
  LEFT JOIN sessions s ON s.id = si.session_id
  WHERE si.lesson_id = ?
  ORDER BY si.created_at DESC
`).all(Number(lessonId));

const getRecentLessonHistory = (limit = 10) => db.prepare(`
  SELECT si.*, l.title AS lesson_title
  FROM session_items si
  JOIN lessons l ON l.id = si.lesson_id
  ORDER BY si.created_at DESC
  LIMIT ?
`).all(Number(limit));

const getRecommendedLesson = () => one(`
  SELECT l.*
  FROM lessons l
  WHERE l.lesson_type = 'core' AND l.id NOT IN (
    SELECT lesson_id FROM session_items WHERE lesson_id IS NOT NULL AND completed = 1
  )
  ORDER BY l.sort_order ASC, l.id ASC
`);

const saveAttachment = (data = {}) => {
  const result = db.prepare(`INSERT INTO attachments (entity_type,entity_id,kind,filename,mime,size_bytes,storage_path,caption,created_at)
    VALUES (@entity_type,@entity_id,@kind,@filename,@mime,@size_bytes,@storage_path,@caption,@created_at)`).run({
    entity_type: data.entity_type,
    entity_id: Number(data.entity_id),
    kind: data.kind,
    filename: data.filename,
    mime: data.mime,
    size_bytes: Number(data.size_bytes) || 0,
    storage_path: data.storage_path,
    caption: data.caption || '',
    created_at: Date.now(),
  });
  return one('SELECT * FROM attachments WHERE id = ?', result.lastInsertRowid);
};
const listAttachments = (entityType, entityId) => db.prepare('SELECT * FROM attachments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC, id DESC').all(entityType, Number(entityId));
const getAttachment = (id) => one('SELECT * FROM attachments WHERE id = ?', Number(id));
const deleteAttachment = (id) => run('DELETE FROM attachments WHERE id = ?', Number(id));

const saveVideoAttachment = (data = {}) => {
  const result = db.prepare(`INSERT INTO video_attachments (video_id,kind,title,url,filename,mime,size_bytes,storage_path,created_at)
    VALUES (@video_id,@kind,@title,@url,@filename,@mime,@size_bytes,@storage_path,@created_at)`).run({
    video_id: Number(data.video_id),
    kind: data.kind,
    title: data.title || '',
    url: data.url || '',
    filename: data.filename || '',
    mime: data.mime || '',
    size_bytes: Number(data.size_bytes) || 0,
    storage_path: data.storage_path || '',
    created_at: Date.now(),
  });
  return one('SELECT * FROM video_attachments WHERE id = ?', result.lastInsertRowid);
};
const listVideoAttachments = (videoId) => db.prepare('SELECT * FROM video_attachments WHERE video_id = ? ORDER BY created_at DESC, id DESC').all(Number(videoId));
const getVideoAttachment = (id) => one('SELECT * FROM video_attachments WHERE id = ?', Number(id));
const deleteVideoAttachment = (id) => run('DELETE FROM video_attachments WHERE id = ?', Number(id));

const listPlaylistItems = (playlistId) => db.prepare(`
  SELECT *
  FROM video_playlist_items
  WHERE COALESCE(playlist_id, playlistId) = ?
  ORDER BY COALESCE(order_index, position, 0) ASC, id ASC
`).all(Number(playlistId));

const playlistContainsTarget = (playlistId, targetId, visited = new Set()) => {
  const start = Number(playlistId);
  const target = Number(targetId);
  if (!start || !target) return false;
  if (start === target) return true;
  if (visited.has(start)) return false;
  visited.add(start);
  const children = db.prepare(`
    SELECT child_playlist_id
    FROM video_playlist_items
    WHERE COALESCE(playlist_id, playlistId) = ?
      AND COALESCE(item_type, 'video') = 'playlist'
      AND child_playlist_id IS NOT NULL
  `).all(start);
  for (const child of children) {
    const childId = Number(child.child_playlist_id);
    if (!childId) continue;
    if (childId === target) return true;
    if (playlistContainsTarget(childId, target, visited)) return true;
  }
  return false;
};

const getPlaylistFirstThumbnail = (playlistId, visited = new Set()) => {
  const targetId = Number(playlistId);
  if (!targetId || visited.has(targetId)) return '';
  visited.add(targetId);
  const items = listPlaylistItems(targetId);
  for (const item of items) {
    const itemType = String(item.item_type || 'video');
    if (itemType === 'video') {
      const videoId = Number(item.video_id || item.videoId);
      if (!videoId) continue;
      const video = getTrainingVideo(videoId);
      const thumb = video?.thumbnail_url || video?.thumb_url || video?.thumbUrl || '';
      if (thumb) return thumb;
      continue;
    }
    if (itemType === 'playlist') {
      const childId = Number(item.child_playlist_id);
      if (!childId) continue;
      const nested = getPlaylistFirstThumbnail(childId, visited);
      if (nested) return nested;
    }
  }
  return '';
};
const listPlaylistsByVideo = (videoId) => db.prepare(`
  SELECT p.*, COALESCE(i.order_index, i.position, 0) AS position
  FROM video_playlist_items i
  JOIN video_playlists p ON p.id = COALESCE(i.playlist_id, i.playlistId)
  WHERE COALESCE(i.item_type, 'video') = 'video'
    AND COALESCE(i.video_id, i.videoId) = ?
  ORDER BY p.name COLLATE NOCASE ASC
`).all(Number(videoId));
const replacePlaylistItems = (playlistId, items = []) => {
  const tx = db.transaction((targetPlaylistId, nextItems) => {
    run('DELETE FROM video_playlist_items WHERE COALESCE(playlist_id, playlistId) = ?', targetPlaylistId);
    const insert = db.prepare('INSERT INTO video_playlist_items (playlistId,playlist_id,item_type,videoId,video_id,child_playlist_id,position,order_index) VALUES (?,?,?,?,?,?,?,?)');
    nextItems.forEach((item, index) => {
      const itemType = String(item.item_type || item.itemType || 'video');
      const requestedOrder = Number(item.order_index ?? item.position);
      const orderIndex = Number.isFinite(requestedOrder) ? requestedOrder : index + 1;
      if (itemType === 'playlist') {
        const childPlaylistId = Number(item.child_playlist_id || item.childPlaylistId);
        if (!childPlaylistId) return;
        if (childPlaylistId === targetPlaylistId) throw new Error('Playlist cannot contain itself');
        if (playlistContainsTarget(childPlaylistId, targetPlaylistId)) throw new Error('Adding this playlist would create a cycle');
        insert.run(targetPlaylistId, targetPlaylistId, 'playlist', null, null, childPlaylistId, orderIndex, orderIndex);
        return;
      }
      const videoId = Number(item.video_id || item.videoId);
      if (!videoId) return;
      insert.run(targetPlaylistId, targetPlaylistId, 'video', videoId, videoId, null, orderIndex, orderIndex);
    });
    db.prepare('UPDATE video_playlists SET updatedAt = ? WHERE id = ?').run(Date.now(), targetPlaylistId);
  });
  tx(Number(playlistId), items);
  return listPlaylistItems(playlistId);
};

const addPlaylistItem = (playlistId, item = {}) => {
  const targetPlaylistId = Number(playlistId);
  const parent = getVideoPlaylist(targetPlaylistId);
  if (!parent) throw new Error('playlist not found');
  const itemType = String(item.item_type || item.itemType || 'video');
  const now = Date.now();
  const existingCount = Number(one('SELECT COUNT(1) AS c FROM video_playlist_items WHERE COALESCE(playlist_id, playlistId) = ?', targetPlaylistId)?.c || 0);
  const requestedOrder = Number(item.order_index);
  const orderIndex = Number.isFinite(requestedOrder) ? requestedOrder : existingCount + 1;
  if (itemType === 'playlist') {
    const childPlaylistId = Number(item.child_playlist_id || item.childPlaylistId);
    if (!childPlaylistId) throw new Error('child_playlist_id is required');
    if (!getVideoPlaylist(childPlaylistId)) throw new Error('child playlist not found');
    if (childPlaylistId === targetPlaylistId) throw new Error('Playlist cannot contain itself');
    if (playlistContainsTarget(childPlaylistId, targetPlaylistId)) throw new Error('Adding this playlist would create a cycle');
    const result = db.prepare('INSERT INTO video_playlist_items (playlistId,playlist_id,item_type,videoId,video_id,child_playlist_id,position,order_index) VALUES (?,?,?,?,?,?,?,?)')
      .run(targetPlaylistId, targetPlaylistId, 'playlist', null, null, childPlaylistId, orderIndex, orderIndex);
    run('UPDATE video_playlists SET updatedAt = ? WHERE id = ?', now, targetPlaylistId);
    return one('SELECT * FROM video_playlist_items WHERE id = ?', result.lastInsertRowid);
  }
  const videoId = Number(item.video_id || item.videoId);
  if (!videoId) throw new Error('video_id is required');
  if (!getTrainingVideo(videoId)) throw new Error('video not found');
  const result = db.prepare('INSERT INTO video_playlist_items (playlistId,playlist_id,item_type,videoId,video_id,child_playlist_id,position,order_index) VALUES (?,?,?,?,?,?,?,?)')
    .run(targetPlaylistId, targetPlaylistId, 'video', videoId, videoId, null, orderIndex, orderIndex);
  run('UPDATE video_playlists SET updatedAt = ? WHERE id = ?', now, targetPlaylistId);
  return one('SELECT * FROM video_playlist_items WHERE id = ?', result.lastInsertRowid);
};

const deletePlaylistItem = (playlistId, itemId) => {
  const targetPlaylistId = Number(playlistId);
  run('DELETE FROM video_playlist_items WHERE id = ? AND COALESCE(playlist_id, playlistId) = ?', Number(itemId), targetPlaylistId);
  run('UPDATE video_playlists SET updatedAt = ? WHERE id = ?', Date.now(), targetPlaylistId);
};

const listTrainingPlaylists = () => all('SELECT * FROM training_playlists ORDER BY updated_at DESC, name COLLATE NOCASE ASC');
const getTrainingPlaylist = (id) => one('SELECT * FROM training_playlists WHERE id = ?', Number(id));
const saveTrainingPlaylist = (data = {}) => {
  const now = Date.now();
  if (data.id) {
    run('UPDATE training_playlists SET name=@name, description=@description, updated_at=@updated_at WHERE id=@id', {
      id: Number(data.id),
      name: data.name || '',
      description: data.description || '',
      updated_at: now,
    });
    return getTrainingPlaylist(data.id);
  }
  const result = db.prepare('INSERT INTO training_playlists (name,description,created_at,updated_at) VALUES (@name,@description,@created_at,@updated_at)').run({
    name: data.name || '',
    description: data.description || '',
    created_at: now,
    updated_at: now,
  });
  return getTrainingPlaylist(result.lastInsertRowid);
};
const deleteTrainingPlaylist = (id) => {
  const playlistId = Number(id);
  const tx = db.transaction((targetId) => {
    run('DELETE FROM training_playlist_items WHERE playlist_id = ?', targetId);
    run('DELETE FROM training_playlists WHERE id = ?', targetId);
  });
  tx(playlistId);
};
const listTrainingPlaylistItems = (playlistId) => db.prepare(`
  SELECT i.*, l.title AS lesson_title, l.module_id
  FROM training_playlist_items i
  LEFT JOIN lessons l ON l.id = i.lesson_id
  WHERE i.playlist_id = ?
  ORDER BY i.position ASC, i.id ASC
`).all(Number(playlistId));
const replaceTrainingPlaylistItems = (playlistId, items = []) => {
  const targetId = Number(playlistId);
  const tx = db.transaction((id, nextItems) => {
    run('DELETE FROM training_playlist_items WHERE playlist_id = ?', id);
    const stmt = db.prepare('INSERT INTO training_playlist_items (playlist_id,lesson_id,position,created_at) VALUES (?,?,?,?)');
    nextItems.forEach((item, idx) => {
      const lessonId = Number(item.lesson_id || item.lessonId);
      if (!lessonId) return;
      stmt.run(id, lessonId, Number(item.position) || idx + 1, Date.now());
    });
    run('UPDATE training_playlists SET updated_at = ? WHERE id = ?', Date.now(), id);
  });
  tx(targetId, items);
  return listTrainingPlaylistItems(targetId);
};

const clearAll = () => db.exec('DELETE FROM session_items; DELETE FROM lesson_skills; DELETE FROM lessons; DELETE FROM modules; DELETE FROM courses; DELETE FROM providers; DELETE FROM attachments; DELETE FROM session_gear; DELETE FROM gear_links; DELETE FROM gear_images; DELETE FROM sessions; DELETE FROM gear_items; DELETE FROM resources; DELETE FROM presets;');


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


const listUserTables = () => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC").all().map((row) => row.name);
const listTableRows = (table) => db.prepare(`SELECT * FROM "${table.replace(/"/g, '""')}"`).all();
const exportAllTables = () => {
  const tables = {};
  listUserTables().forEach((table) => {
    tables[table] = listTableRows(table);
  });
  return tables;
};
const importAllTables = (tables = {}) => {
  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) throw new Error('invalid backup tables payload');
  ensureSchema();
  const tableNames = listUserTables();
  const tx = db.transaction(() => {
    db.exec('PRAGMA foreign_keys = OFF;');
    tableNames.forEach((table) => {
      db.prepare(`DELETE FROM "${table.replace(/"/g, '""')}"`).run();
    });
    tableNames.forEach((table) => {
      const rows = Array.isArray(tables[table]) ? tables[table] : [];
      if (!rows.length) return;
      const cols = db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`).all().map((col) => col.name);
      rows.forEach((row) => {
        const keys = cols.filter((key) => Object.prototype.hasOwnProperty.call(row || {}, key));
        if (!keys.length) return;
        const sql = `INSERT INTO "${table.replace(/"/g, '""')}" (${keys.map((k) => `"${k.replace(/"/g, '""')}"`).join(',')}) VALUES (${keys.map((k) => `@${k}`).join(',')})`;
        db.prepare(sql).run(row);
      });
    });
    db.exec('PRAGMA foreign_keys = ON;');
  });
  tx();
  checkpointWal();
  return tableNames;
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



const listTrainingProviders = () => all('SELECT * FROM providers ORDER BY name COLLATE NOCASE ASC');
const getTrainingProvider = (id) => one('SELECT * FROM providers WHERE id = ?', Number(id));
const saveTrainingProvider = (data = {}) => {
  const now = Date.now();
  if (data.id) {
    run('UPDATE providers SET name=@name, slug=@slug, url=@url WHERE id=@id', { id: Number(data.id), name: data.name || '', slug: data.slug || slugify(data.name), url: data.url || '' });
    return getTrainingProvider(data.id);
  }
  const result = db.prepare('INSERT INTO providers (name,slug,url,created_at) VALUES (@name,@slug,@url,@created_at)').run({ name: data.name || '', slug: data.slug || slugify(data.name), url: data.url || '', created_at: now });
  return getTrainingProvider(result.lastInsertRowid);
};
const deleteTrainingProvider = (id) => run('DELETE FROM providers WHERE id = ?', Number(id));

const listLevels = (providerId) => db.prepare(`SELECT * FROM levels ${providerId ? 'WHERE provider_id = ?' : ''} ORDER BY sort_order ASC, id ASC`).all(...(providerId ? [Number(providerId)] : []));
const bootstrapProviderLevels = (providerId) => {
  const provider = getTrainingProvider(providerId);
  if (!provider) throw new Error('provider not found');
  const map = [['Beginner',1,10],['Beginner',2,20],['Beginner',3,30],['Intermediate',1,40],['Intermediate',2,50],['Intermediate',3,60],['Advanced',1,70],['Advanced',2,80],['Advanced',3,90]];
  map.forEach(([track,num,sort]) => db.prepare(`INSERT INTO levels (provider_id,track,level_num,name,sort_order,created_at)
  SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM levels WHERE provider_id=? AND track=? AND level_num=?)`).run(provider.id, track, num, `${track} ${num}`, sort, Date.now(), provider.id, track, num));
  return listLevels(provider.id);
};
const listTrainingModules = (levelId) => db.prepare(`SELECT * FROM modules ${levelId ? 'WHERE level_id = ?' : ''} ORDER BY sort_order ASC, id ASC`).all(...(levelId ? [Number(levelId)] : []));
const getTrainingModule = (id) => one('SELECT * FROM modules WHERE id = ?', Number(id));
const saveTrainingModule = (data = {}) => {
  const now = Date.now();
  if (data.id) {
    run('UPDATE modules SET level_id=@level_id,title=@title,description=@description,module_num=@module_num,sort_order=@sort_order,thumb_url=@thumb_url WHERE id=@id', {
      id: Number(data.id), level_id: Number(data.level_id) || null, title: data.title || '', description: data.description || '', module_num: Number(data.module_num) || 0, sort_order: Number(data.sort_order) || 0, thumb_url: data.thumb_url || null,
    });
    return getTrainingModule(data.id);
  }
  const result = db.prepare('INSERT INTO modules (level_id,title,description,module_num,sort_order,thumb_url,created_at,course_id,slug) VALUES (@level_id,@title,@description,@module_num,@sort_order,@thumb_url,@created_at,@course_id,@slug)').run({
    level_id: Number(data.level_id) || null, title: data.title || '', description: data.description || '', module_num: Number(data.module_num) || 0, sort_order: Number(data.sort_order) || 0, thumb_url: data.thumb_url || null, created_at: now, course_id: Number(data.course_id) || 0, slug: data.slug || slugify(data.title || `module-${now}`),
  });
  return getTrainingModule(result.lastInsertRowid);
};

const listTrainingLessons = (filters = {}) => {
  const where = []; const vals = [];
  if (filters.module_id) { where.push('l.module_id = ?'); vals.push(Number(filters.module_id)); }
  if (filters.q) { where.push('(l.title LIKE ? OR l.description LIKE ?)'); vals.push(`%${filters.q}%`, `%${filters.q}%`); }
  if (filters.kind) { where.push('l.lesson_kind = ?'); vals.push(String(filters.kind)); }
  if (filters.track) { where.push('lv.track = ?'); vals.push(String(filters.track)); }
  if (filters.level_num) { where.push('lv.level_num = ?'); vals.push(Number(filters.level_num)); }
  if (filters.skill_slug) { where.push('sk.slug = ?'); vals.push(String(filters.skill_slug)); }
  const sql = `SELECT DISTINCT l.* FROM lessons l
    LEFT JOIN modules m ON m.id = l.module_id
    LEFT JOIN levels lv ON lv.id = m.level_id
    LEFT JOIN lesson_skills ls ON ls.lesson_id = l.id
    LEFT JOIN skills sk ON sk.id = ls.skill_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY l.sort_order ASC, l.id ASC`;
  return db.prepare(sql).all(...vals);
};
const getTrainingLesson = (id) => {
  const row = one('SELECT * FROM lessons WHERE id = ?', Number(id));
  if (!row) return null;
  const skills = db.prepare('SELECT s.* FROM lesson_skills ls JOIN skills s ON s.id = ls.skill_id WHERE ls.lesson_id = ? ORDER BY s.name').all(Number(id));
  const songs = db.prepare('SELECT so.* FROM song_lessons sl JOIN songs so ON so.id = sl.song_id WHERE sl.lesson_id = ? ORDER BY sl.sort_order ASC').all(Number(id));
  return { ...row, skills, songs };
};
const saveTrainingLesson = (data = {}) => {
  const now = Date.now();
  const payload = {
    module_id: data.module_id == null || data.module_id === '' ? null : Number(data.module_id), title: data.title || '', description: data.description || '', video_url: data.video_url || '', video_provider: data.video_provider || '', video_id: data.video_id || '', thumb_url: data.thumb_url || '', duration_sec: Number(data.duration_sec) || 0, skill_tags: data.skill_tags || '', lesson_kind: data.lesson_kind || 'lesson', sort_order: Number(data.sort_order) || 0,
  };
  if (data.id) {
    run('UPDATE lessons SET module_id=@module_id,title=@title,description=@description,video_url=@video_url,video_provider=@video_provider,video_id=@video_id,thumb_url=@thumb_url,duration_sec=@duration_sec,skill_tags=@skill_tags,lesson_kind=@lesson_kind,sort_order=@sort_order,updated_at=@updated_at WHERE id=@id', { ...payload, id: Number(data.id), updated_at: now });
    return getTrainingLesson(data.id);
  }
  const result = db.prepare('INSERT INTO lessons (module_id,title,description,video_url,video_provider,video_id,thumb_url,duration_sec,skill_tags,lesson_kind,sort_order,created_at,updated_at,slug,lesson_type,author,summary,practice_plan,notes) VALUES (@module_id,@title,@description,@video_url,@video_provider,@video_id,@thumb_url,@duration_sec,@skill_tags,@lesson_kind,@sort_order,@created_at,@updated_at,@slug,@lesson_type,@author,@summary,@practice_plan,@notes)').run({ ...payload, created_at: now, updated_at: now, slug: slugify(payload.title), lesson_type: 'core', author: '', summary: '', practice_plan: '', notes: '' });
  return getTrainingLesson(result.lastInsertRowid);
};
const deleteTrainingLesson = (id) => { run('DELETE FROM lesson_skills WHERE lesson_id = ?', Number(id)); run('DELETE FROM song_lessons WHERE lesson_id = ?', Number(id)); return run('DELETE FROM lessons WHERE id = ?', Number(id)); };
const saveLessonSkillLinks = (lessonId, skillIds = []) => { run('DELETE FROM lesson_skills WHERE lesson_id = ?', Number(lessonId)); const st = db.prepare('INSERT INTO lesson_skills (lesson_id,skill_id) VALUES (?,?)'); skillIds.forEach((sid) => { if (Number(sid)) st.run(Number(lessonId), Number(sid)); }); };
const listSkillGroups = () => {
  const groups = all('SELECT * FROM skill_groups ORDER BY sort_order ASC, name ASC');
  return groups.map((g) => ({ ...g, skills: db.prepare('SELECT * FROM skills WHERE group_id = ? ORDER BY name ASC').all(g.id) }));
};
const getSkillLessons = (slug) => listTrainingLessons({ skill_slug: slug });
const saveSkillGroup = (data = {}) => {
  const now = Date.now();
  if (data.id) { run('UPDATE skill_groups SET name=@name, slug=@slug, sort_order=@sort_order WHERE id=@id', { id: Number(data.id), name: data.name || '', slug: data.slug || slugify(data.name), sort_order: Number(data.sort_order) || 0 }); return one('SELECT * FROM skill_groups WHERE id = ?', Number(data.id)); }
  const r = db.prepare('INSERT INTO skill_groups (name,slug,sort_order,created_at) VALUES (?,?,?,?)').run(data.name || '', data.slug || slugify(data.name), Number(data.sort_order) || 0, now); return one('SELECT * FROM skill_groups WHERE id = ?', r.lastInsertRowid);
};
const saveSkill = (data = {}) => {
  const now = Date.now();
  if (data.id) { run('UPDATE skills SET group_id=@group_id,name=@name,slug=@slug WHERE id=@id', { id: Number(data.id), group_id: Number(data.group_id), name: data.name || '', slug: data.slug || slugify(data.name) }); return one('SELECT * FROM skills WHERE id = ?', Number(data.id)); }
  const r = db.prepare('INSERT INTO skills (group_id,name,slug,created_at) VALUES (?,?,?,?)').run(Number(data.group_id), data.name || '', data.slug || slugify(data.name), now); return one('SELECT * FROM skills WHERE id = ?', r.lastInsertRowid);
};
const listSongs = (filters = {}) => {
  const where = []; const vals = [];
  if (filters.q) { where.push('(title LIKE ? OR artist LIKE ?)'); vals.push(`%${filters.q}%`, `%${filters.q}%`); }
  if (filters.provider_id) { where.push('provider_id = ?'); vals.push(Number(filters.provider_id)); }
  if (filters.level_hint) { where.push('level_hint = ?'); vals.push(String(filters.level_hint)); }
  return db.prepare(`SELECT * FROM songs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY title COLLATE NOCASE ASC`).all(...vals);
};
const getSong = (id) => {
  const song = one('SELECT * FROM songs WHERE id = ?', Number(id));
  if (!song) return null;
  const lessons = db.prepare('SELECT l.* FROM song_lessons sl JOIN lessons l ON l.id = sl.lesson_id WHERE sl.song_id = ? ORDER BY sl.sort_order ASC, l.id ASC').all(Number(id));
  return { ...song, lessons };
};
const saveSong = (data = {}) => {
  const now = Date.now();
  if (data.id) { run('UPDATE songs SET provider_id=@provider_id,title=@title,artist=@artist,level_hint=@level_hint,thumb_url=@thumb_url WHERE id=@id', { id: Number(data.id), provider_id: Number(data.provider_id), title: data.title || '', artist: data.artist || '', level_hint: data.level_hint || '', thumb_url: data.thumb_url || '' }); return getSong(data.id); }
  const r = db.prepare('INSERT INTO songs (provider_id,title,artist,level_hint,thumb_url,created_at) VALUES (?,?,?,?,?,?)').run(Number(data.provider_id), data.title || '', data.artist || '', data.level_hint || '', data.thumb_url || '', now); return getSong(r.lastInsertRowid);
};
const deleteSong = (id) => { run('DELETE FROM song_lessons WHERE song_id = ?', Number(id)); run('DELETE FROM songs WHERE id = ?', Number(id)); };
const assignSongLessons = (songId, lessonIds = []) => {
  run('DELETE FROM song_lessons WHERE song_id = ?', Number(songId));
  const st = db.prepare('INSERT INTO song_lessons (song_id,lesson_id,sort_order) VALUES (?,?,?)');
  lessonIds.forEach((lid, idx) => { if (Number(lid)) st.run(Number(songId), Number(lid), idx); });
  return getSong(songId);
};

const dbInfo = getDbInfo();
console.log(`[DB INFO] path=${dbInfo.dbPath} size=${dbInfo.sizeBytes} modified=${dbInfo.modifiedAt} sessions=${dbInfo.sessions} gear=${dbInfo.gear} presets=${dbInfo.presets}`);

module.exports = { listTrainingProviders, getTrainingProvider, saveTrainingProvider, deleteTrainingProvider, listLevels, bootstrapProviderLevels, listTrainingModules, getTrainingModule, saveTrainingModule, listTrainingLessons, getTrainingLesson, saveTrainingLesson, deleteTrainingLesson, saveLessonSkillLinks, listSkillGroups, getSkillLessons, saveSkillGroup, saveSkill, listSongs, getSong, saveSong, deleteSong, assignSongLessons, dbPath, getDbInfo, listSessions, listSessionDailyTotals, getSession, saveSession, deleteSession, listGear, getGear, saveGear, deleteGear, getGearLinks, saveGearLink, deleteGearLink, replaceGearLinks, listGearImages, addGearImage, getGearImage, deleteGearImage, saveSessionGear, listSessionGear, listSessionGearBySessionIds, getGearUsage, listPresets, getPreset, savePreset, deletePreset, listResources, getResource, saveResource, deleteResource, listTrainingVideos, getTrainingVideo, saveTrainingVideo, saveTrainingVideoUpload, saveTrainingVideoThumbnail, deleteTrainingVideo, getTrainingVideoProgress, saveTrainingVideoProgress, listVideoTimestamps, saveVideoTimestamp, deleteVideoTimestamp, listVideoPlaylists, listPlaylistGroups, getVideoPlaylist, saveVideoPlaylist, deleteVideoPlaylist, listPlaylistItems, listPlaylistsByVideo, replacePlaylistItems, addPlaylistItem, deletePlaylistItem, playlistContainsTarget, getPlaylistFirstThumbnail, listProviders, getProvider, saveProvider, listCourses, getCourse, saveCourse, listModules, getModule, saveModule, listLessons, getLesson, saveLesson, deleteLesson, saveLessonSkills, createDraftSession, addSessionItem, updateSessionItem, deleteSessionItem, listSessionItems, getSessionWithItems, finishSession, getLessonStats, getLessonHistory, getRecentLessonHistory, getRecommendedLesson, saveAttachment, listAttachments, getAttachment, deleteAttachment, saveVideoAttachment, listVideoAttachments, getVideoAttachment, deleteVideoAttachment, listTrainingPlaylists, getTrainingPlaylist, saveTrainingPlaylist, deleteTrainingPlaylist, listTrainingPlaylistItems, replaceTrainingPlaylistItems, clearAll, checkpointWal, backupToFile, close, reopen, ensureSchema, exportAllTables, importAllTables, listUserTables };

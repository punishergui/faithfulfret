#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'faithfulfret-migration-'));
process.env.FF_DATA_DIR = tempRoot;
const dbPath = path.join(tempRoot, 'faithfulfret.sqlite');

const legacyDb = new Database(dbPath);
legacyDb.exec(`
  CREATE TABLE albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    path TEXT
  );
  INSERT INTO albums (title, path) VALUES ('Legacy Album', '/music/Artist/.crate/legacy-album');
  PRAGMA user_version = 0;
`);
legacyDb.close();

const store = require('../../data-store');
const migratedDb = new Database(store.dbPath, { readonly: true });
const columns = migratedDb.prepare('PRAGMA table_info(albums);').all().map((row) => row.name);
const row = migratedDb.prepare("SELECT albumKey FROM albums WHERE title = 'Legacy Album'").get();
const userVersionRow = migratedDb.prepare('PRAGMA user_version;').get();
const userVersion = Number(Object.values(userVersionRow || {})[0] || 0);
migratedDb.close();
store.close();

if (!columns.includes('albumKey')) {
  throw new Error('migration failed: albums.albumKey is missing');
}
if (userVersion < 2) {
  throw new Error(`migration failed: expected user_version >= 2 but got ${userVersion}`);
}
if (!row || !row.albumKey) {
  throw new Error('migration failed: albumKey backfill did not run');
}

console.log('migration smoke test passed');
console.log(`dbPath=${dbPath}`);
console.log(`user_version=${userVersion}`);
console.log(`albumKey=${row.albumKey}`);

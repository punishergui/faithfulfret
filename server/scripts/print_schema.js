#!/usr/bin/env node
const path = require('path');
const Database = require('better-sqlite3');

const dbFile = process.argv[2] || process.env.FF_DB_PATH || '/data/faithfulfret.sqlite';
const db = new Database(path.resolve(dbFile), { readonly: true });

const userVersionRow = db.prepare('PRAGMA user_version;').get();
const userVersion = Number(Object.values(userVersionRow || {})[0] || 0);
const albumColumns = db.prepare('PRAGMA table_info(albums);').all().map((row) => row.name);

console.log(`db: ${path.resolve(dbFile)}`);
console.log(`user_version: ${userVersion}`);
console.log(`albums_columns: ${albumColumns.join(', ') || '(table missing)'}`);

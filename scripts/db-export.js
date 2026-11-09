#!/usr/bin/env node
'use strict';
// Usage: node scripts/db-export.js [folder]
// Writes everything in the database back out as JSON files (a backup, or a way to return to file storage).
// Default folder: ./storage-export  (nothing in ./storage is touched).
require('../src/lib/env');
const fs = require('fs');
const path = require('path');
const db = require('../src/lib/db');

(async () => {
  if (!db.enabled) { console.error('No database settings found (DB_NAME). Nothing to export.'); process.exit(1); }
  const out = path.resolve(process.argv[2] || 'storage-export');
  fs.mkdirSync(path.join(out, 'content', '_history'), { recursive: true });
  await db.connect();
  for (const name of db.COLLECTIONS) {
    const rows = await db.loadAll(name);
    fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(rows, null, 2));
    console.log(`${name}: ${rows.length}`);
  }
  const c = await db.loadContent();
  for (const [n, obj] of Object.entries(c.live)) fs.writeFileSync(path.join(out, 'content', `${n}.json`), JSON.stringify(obj, null, 2));
  for (const h of c.history) fs.writeFileSync(path.join(out, 'content', '_history', h.file), JSON.stringify({ name: h.name, note: h.note, savedAt: h.savedAt, data: h.data }, null, 2));
  console.log(`content: ${Object.keys(c.live).length} sections, ${c.history.length} versions`);
  console.log(`Written to ${out}`);
  await db.close();
})().catch((e) => { console.error(e.message); process.exit(1); });

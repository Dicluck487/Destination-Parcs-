'use strict';
// Start-up launcher. With database settings in .env it connects to MySQL first, loads the data,
// then starts the website (app.js). Without them it runs on JSON files exactly as before.
require('./src/lib/env');
const db = require('./src/lib/db');

async function boot() {
  if (db.enabled) {
    await db.connect();
    const store = require('./src/lib/store');
    const content = require('./src/lib/content');
    const rep = await store.loadFromDb();
    console.log('[db] connected. Records:', Object.entries(rep).map(([k, v]) => `${k}: ${v}`).join('; '));
    console.log('[db] content:', await content.loadFromDb());
  } else {
    console.log('[storage] using JSON files (set DB_NAME in .env to use MySQL)');
  }
  const { app, PORT, BASE_URL } = require('./app');
  const server = app.listen(PORT, () => console.log(`Destination Parcs running at ${BASE_URL}`));

  let closing = false;
  const stop = async () => {
    if (closing) return; closing = true;
    server.close();
    try { await db.close(); } catch (e) { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

boot().catch((e) => { console.error('Start-up failed:', e.message); process.exit(1); });

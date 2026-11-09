'use strict';
/**
 * Optional MySQL / MariaDB storage.
 *
 * Turn it on by setting DB_NAME (plus DB_USER, DB_PASSWORD, DB_HOST) or DATABASE_URL in .env.
 * With no database settings the site keeps using JSON files in /storage, exactly as before.
 *
 * How it works: on start-up everything is loaded from the database into memory, so reads are
 * instant and the rest of the code does not change. Every change is written straight to the
 * database in order, with retries. The database is the permanent copy.
 * Run ONE Node process per database (the normal setup on cPanel).
 */
const mysql = require('mysql2/promise');

function config() {
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    return { host: u.hostname, port: Number(u.port) || 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: u.pathname.replace(/^\//, '') };
  }
  if (!process.env.DB_NAME) return null;
  return {
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME,
  };
}

const cfg = config();
const enabled = !!cfg;
const P = (process.env.DB_PREFIX || 'dp_').replace(/[^a-z0-9_]/gi, '');
const T = (n) => `\`${P}${n}\``;

// ---- table definitions: a few searchable columns plus the full record as JSON text
const dt = (iso) => (iso ? new Date(iso).toISOString().slice(0, 23).replace('T', ' ') : null);
const DEFS = {
  users: { cols: { email: 'VARCHAR(190) NULL', phone: 'VARCHAR(40) NULL' }, idx: ['email', 'phone'], pick: (r) => ({ email: r.email || null, phone: r.phone || null }) },
  bookings: {
    cols: { ref: 'VARCHAR(24) NOT NULL', user_id: 'CHAR(36) NULL', status: 'VARCHAR(30) NULL', check_in: 'DATE NULL', nights: 'INT NULL', stay_slug: 'VARCHAR(80) NULL' },
    unique: ['ref'], idx: ['user_id', 'status', 'check_in', 'stay_slug'],
    pick: (r) => ({ ref: r.ref, user_id: r.userId || null, status: r.status || null, check_in: r.checkIn || null, nights: r.nights == null ? null : r.nights, stay_slug: (r.stay && r.stay.slug) || null }),
  },
  enquiries: { cols: { status: 'VARCHAR(20) NULL', email: 'VARCHAR(190) NULL' }, idx: ['status'], pick: (r) => ({ status: r.status || null, email: r.email || null }) },
  quotes: { cols: { status: 'VARCHAR(20) NULL', email: 'VARCHAR(190) NULL' }, idx: ['status'], pick: (r) => ({ status: r.status || null, email: r.email || null }) },
  admins: { cols: { username: 'VARCHAR(60) NOT NULL' }, unique: ['username'], idx: [], pick: (r) => ({ username: r.username }) },
  media: { cols: { kind: 'VARCHAR(12) NULL' }, idx: ['kind'], pick: (r) => ({ kind: r.kind || null }) },
};
const COLLECTIONS = Object.keys(DEFS);

let pool = null;
const state = { ok: !enabled, pending: 0, lastError: '', lastWrite: null };

async function connect() {
  if (!enabled) return;
  pool = mysql.createPool({ ...cfg, waitForConnections: true, connectionLimit: 5, charset: 'utf8mb4', timezone: 'Z', dateStrings: true, ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined });
  try { await pool.query('SELECT 1'); } catch (e) {
    throw new Error(`Cannot connect to the database "${cfg.database}" on ${cfg.host}:${cfg.port} as ${cfg.user}: ${e.message}`);
  }
  for (const [name, d] of Object.entries(DEFS)) {
    const cols = Object.entries(d.cols).map(([c, t]) => `\`${c}\` ${t}`).join(', ');
    const keys = [...(d.unique || []).map((c) => `UNIQUE KEY \`u_${c}\` (\`${c}\`)`), ...(d.idx || []).map((c) => `KEY \`i_${c}\` (\`${c}\`)`)];
    await pool.query(`CREATE TABLE IF NOT EXISTS ${T(name)} (
      id CHAR(36) NOT NULL PRIMARY KEY, created_at DATETIME(3) NULL, updated_at DATETIME(3) NULL, ${cols},
      data LONGTEXT NOT NULL${keys.length ? ', ' + keys.join(', ') : ''}
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS ${T('content')} (
    name VARCHAR(40) NOT NULL PRIMARY KEY, updated_at DATETIME(3) NULL, data LONGTEXT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ${T('content_history')} (
    id INT AUTO_INCREMENT PRIMARY KEY, file_key VARCHAR(80) NOT NULL, name VARCHAR(40) NOT NULL, note VARCHAR(400) NULL,
    saved_at DATETIME(3) NULL, data LONGTEXT NOT NULL, UNIQUE KEY u_file (file_key), KEY i_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  state.ok = true;
}

// ---- ordered write queue with retries
let chain = Promise.resolve();
function enqueue(label, fn) {
  state.pending += 1;
  chain = chain.then(async () => {
    let last;
    for (let i = 0; i < 4; i++) {
      try { await fn(); state.ok = true; state.lastError = ''; state.lastWrite = new Date().toISOString(); return; } catch (e) {
        last = e; await new Promise((r) => setTimeout(r, 400 * (i + 1) * (i + 1)));
      }
    }
    state.ok = false; state.lastError = `${label}: ${last.message}`;
    console.error(`[db] write failed after retries (${label}): ${last.message}`);
  }).finally(() => { state.pending -= 1; });
}
const flush = () => chain;

// ---- records
async function loadAll(name) {
  const [rows] = await pool.query(`SELECT data FROM ${T(name)} ORDER BY created_at, id`);
  return rows.map((r) => JSON.parse(r.data));
}

function upsertSql(name, rec) {
  const d = DEFS[name];
  const extra = d.pick(rec);
  const cols = ['id', 'created_at', 'updated_at', ...Object.keys(extra), 'data'];
  const vals = [rec.id, dt(rec.createdAt), dt(rec.updatedAt || rec.createdAt), ...Object.values(extra), JSON.stringify(rec)];
  const upd = cols.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ');
  return [`INSERT INTO ${T(name)} (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON DUPLICATE KEY UPDATE ${upd}`, vals];
}
function saveRecord(name, rec) {
  const [sql, vals] = upsertSql(name, rec); // built now, so later edits to rec do not change what is queued
  enqueue(`save ${name}`, () => pool.query(sql, vals));
}
function deleteRecord(name, id) { enqueue(`delete ${name}`, () => pool.query(`DELETE FROM ${T(name)} WHERE id = ?`, [id])); }
async function bulkInsert(name, items) {
  for (const rec of items) { const [sql, vals] = upsertSql(name, rec); await pool.query(sql, vals); }
}

// ---- content (admin-edited site content) and its history
async function loadContent() {
  const [live] = await pool.query(`SELECT name, data FROM ${T('content')}`);
  const [hist] = await pool.query(`SELECT file_key, name, note, saved_at, data FROM ${T('content_history')} ORDER BY saved_at, id`);
  return {
    live: Object.fromEntries(live.map((r) => [r.name, JSON.parse(r.data)])),
    history: hist.map((h) => ({ file: h.file_key, name: h.name, note: h.note || '', savedAt: new Date(`${h.saved_at.replace(' ', 'T')}Z`).toISOString(), data: JSON.parse(h.data) })),
  };
}
function saveContent(name, obj) {
  const json = JSON.stringify(obj);
  enqueue(`content ${name}`, () => pool.query(`INSERT INTO ${T('content')} (name, updated_at, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE updated_at=VALUES(updated_at), data=VALUES(data)`, [name, dt(new Date().toISOString()), json]));
}
function deleteContent(name) { enqueue(`reset ${name}`, () => pool.query(`DELETE FROM ${T('content')} WHERE name = ?`, [name])); }
function addHistory(e) {
  const json = JSON.stringify(e.data);
  enqueue(`history ${e.name}`, () => pool.query(`INSERT IGNORE INTO ${T('content_history')} (file_key, name, note, saved_at, data) VALUES (?, ?, ?, ?, ?)`, [e.file, e.name, String(e.note || '').slice(0, 400), dt(e.savedAt), json]));
}
function pruneHistory(name, keep) {
  enqueue(`prune ${name}`, () => pool.query(
    `DELETE FROM ${T('content_history')} WHERE name = ? AND id NOT IN (SELECT id FROM (SELECT id FROM ${T('content_history')} WHERE name = ? ORDER BY saved_at DESC, id DESC LIMIT ${Number(keep) | 0}) k)`, [name, name]));
}
async function importContent(live, history) {
  for (const [name, obj] of Object.entries(live)) await pool.query(`INSERT INTO ${T('content')} (name, updated_at, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)`, [name, dt(new Date().toISOString()), JSON.stringify(obj)]);
  for (const e of history) await pool.query(`INSERT IGNORE INTO ${T('content_history')} (file_key, name, note, saved_at, data) VALUES (?, ?, ?, ?, ?)`, [e.file, e.name, String(e.note || '').slice(0, 400), dt(e.savedAt), JSON.stringify(e.data)]);
}

const status = () => ({ enabled, ok: state.ok, pending: state.pending, lastError: state.lastError, lastWrite: state.lastWrite, database: enabled ? cfg.database : '', host: enabled ? cfg.host : '' });
const close = async () => { await flush(); if (pool) await pool.end(); };

module.exports = { enabled, COLLECTIONS, connect, loadAll, saveRecord, deleteRecord, bulkInsert, loadContent, saveContent, deleteContent, addHistory, pruneHistory, importContent, flush, status, close };

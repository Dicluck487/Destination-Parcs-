'use strict';
/**
 * Editable site content.
 * - data/*.json are the shipped defaults ("seed").
 * - Anything saved from the admin is written to storage/content/*.json and wins over the seed.
 * - Every save keeps a snapshot of the previous version in storage/content/_history so any
 *   change can be reverted from Admin > History.
 */
const fs = require('fs');
const path = require('path');

const db = require('./db');

const SEED = path.join(__dirname, '..', '..', 'data');
const LIVE = process.env.CONTENT_DIR || path.join(__dirname, '..', '..', 'storage', 'content');
const HIST = path.join(LIVE, '_history');
if (!db.enabled) fs.mkdirSync(HIST, { recursive: true });

const NAMES = ['site', 'activities', 'breaks', 'stay', 'destinations', 'pages', 'plan', 'corporate'];
const LABELS = {
  site: 'Site settings', activities: 'Activities', breaks: 'Breaks & packages', stay: 'Stay & accommodation',
  destinations: 'Destinations', pages: 'Home page & banners', plan: 'Visit info & FAQs', corporate: 'Corporate lists',
};
const KEEP = 30;

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const livePath = (n) => path.join(LIVE, `${n}.json`);
const seedPath = (n) => path.join(SEED, `${n}.json`);
const check = (n) => { if (!NAMES.includes(n)) throw new Error(`Unknown content set: ${n}`); };

// ---- database mode keeps live content and history in memory, backed by MySQL (see db.js)
const mem = { live: {}, hist: [] }; // hist entries: { file, name, note, savedAt, data }
const clone = (o) => JSON.parse(JSON.stringify(o));

function readFileHistory() {
  if (!fs.existsSync(HIST)) return [];
  return fs.readdirSync(HIST).filter((f) => f.endsWith('.json')).sort().map((f) => {
    try { const j = readJson(path.join(HIST, f)); return { file: f, name: j.name, note: j.note || '', savedAt: j.savedAt, data: j.data }; } catch (e) { return null; }
  }).filter(Boolean);
}
function readFileLive() {
  const out = {};
  NAMES.forEach((n) => { if (fs.existsSync(livePath(n))) { try { out[n] = readJson(livePath(n)); } catch (e) { /* skip unreadable */ } } });
  return out;
}

/** Called once at start-up in database mode. Copies existing file content in if the database has none. */
async function loadFromDb() {
  const got = await db.loadContent();
  if (Object.keys(got.live).length || got.history.length) {
    mem.live = got.live; mem.hist = got.history;
    return `${Object.keys(got.live).length} edited sections and ${got.history.length} saved versions loaded`;
  }
  const live = readFileLive(); const history = readFileHistory();
  await db.importContent(live, history);
  mem.live = live; mem.hist = history;
  return `${Object.keys(live).length} edited sections and ${history.length} saved versions imported from files`;
}

function get(name) {
  check(name);
  if (db.enabled) return clone(mem.live[name] || readJson(seedPath(name)));
  if (fs.existsSync(livePath(name))) {
    try { return readJson(livePath(name)); } catch (e) { console.error(`Live content "${name}" is unreadable, using the default.`, e.message); }
  }
  return readJson(seedPath(name));
}

function atomicWrite(file, obj) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

function snapshot(name, note) {
  const current = get(name);
  const entry = { file: `${name}__${stamp()}.json`, name, note: note || '', savedAt: new Date().toISOString(), data: current };
  if (db.enabled) {
    mem.hist.push(entry); db.addHistory(entry);
    const mine = mem.hist.filter((h) => h.name === name);
    if (mine.length > KEEP) { mem.hist = mem.hist.filter((h) => h.name !== name || mine.slice(-KEEP).includes(h)); db.pruneHistory(name, KEEP); }
    return;
  }
  atomicWrite(path.join(HIST, entry.file), { name, note: entry.note, savedAt: entry.savedAt, data: current });
  const mine = fs.readdirSync(HIST).filter((f) => f.startsWith(`${name}__`)).sort();
  mine.slice(0, Math.max(0, mine.length - KEEP)).forEach((f) => fs.unlinkSync(path.join(HIST, f)));
}

function save(name, obj, note) {
  check(name);
  snapshot(name, note);
  if (db.enabled) { mem.live[name] = clone(obj); db.saveContent(name, obj); return; }
  atomicWrite(livePath(name), obj);
}

function history(name) {
  if (db.enabled) {
    return mem.hist.filter((h) => !name || h.name === name).slice().sort((a, b) => (a.file < b.file ? 1 : -1))
      .map((h) => ({ file: h.file, name: h.name, note: h.note, savedAt: h.savedAt, label: LABELS[h.name] || h.name }));
  }
  return fs.readdirSync(HIST)
    .filter((f) => f.endsWith('.json') && (!name || f.startsWith(`${name}__`)))
    .sort().reverse()
    .map((f) => {
      try { const j = readJson(path.join(HIST, f)); return { file: f, name: j.name, note: j.note, savedAt: j.savedAt, label: LABELS[j.name] || j.name }; } catch (e) { return null; }
    }).filter(Boolean);
}

function restore(file) {
  if (!/^[a-z]+__[0-9TZ-]+\.json$/.test(file)) throw new Error('Bad history file');
  const j = db.enabled ? mem.hist.find((h) => h.file === file) : readJson(path.join(HIST, file));
  if (!j) throw new Error('Version not found');
  check(j.name);
  save(j.name, j.data, `Restored version from ${j.savedAt}`);
  return j.name;
}

/** Throw away admin edits for one set and go back to the shipped default. */
function resetToDefault(name) {
  check(name);
  snapshot(name, 'Before reset to default');
  if (db.enabled) { delete mem.live[name]; db.deleteContent(name); return; }
  if (fs.existsSync(livePath(name))) fs.unlinkSync(livePath(name));
}

const isCustomised = (name) => (db.enabled ? !!mem.live[name] : fs.existsSync(livePath(name)));

const seed = (name) => { check(name); return readJson(seedPath(name)); };

module.exports = { loadFromDb, seed, get, save, history, restore, resetToDefault, isCustomised, NAMES, LABELS };

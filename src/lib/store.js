'use strict';
/**
 * Tiny JSON-file store. One file per collection under /storage.
 * Writes are atomic (temp file + rename). Fine for a single Node process.
 * To move to MySQL/Postgres later, keep this interface and swap the internals.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('./db');

const DIR = process.env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage');
fs.mkdirSync(DIR, { recursive: true });

class Collection {
  constructor(name) {
    this.name = name;
    this.file = path.join(DIR, `${name}.json`);
    this.items = [];
    try {
      this.items = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (e) {
      this.items = [];
    }
  }
  /** Persist after a change. rec is the changed record (null when one was removed). */
  _save(rec, removedId) {
    if (db.enabled) {
      if (rec) db.saveRecord(this.name, rec); else db.deleteRecord(this.name, removedId);
      return;
    }
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.items, null, 2));
    fs.renameSync(tmp, this.file);
  }
  all() { return this.items.slice(); }
  find(fn) { return this.items.find(fn); }
  filter(fn) { return this.items.filter(fn); }
  byId(id) { return this.items.find((i) => i.id === id); }
  remove(id) {
    const n = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    if (this.items.length !== n) this._save(null, id);
    return this.items.length !== n;
  }
  insert(obj) {
    const rec = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...obj };
    this.items.push(rec);
    this._save(rec);
    return rec;
  }
  update(id, patch) {
    const rec = this.byId(id);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    this._save(rec);
    return rec;
  }
}

const collections = {
  users: new Collection('users'),
  bookings: new Collection('bookings'),
  enquiries: new Collection('enquiries'),
  quotes: new Collection('quotes'),
  admins: new Collection('admins'),
  media: new Collection('media'),
};

/**
 * Database mode: load every collection from MySQL. If a table is still empty but the old JSON
 * file has records, they are copied into the database once (nothing is deleted from the files).
 */
async function loadFromDb() {
  const report = {};
  for (const [name, c] of Object.entries(collections)) {
    const rows = await db.loadAll(name);
    if (rows.length) { c.items = rows; report[name] = `${rows.length} loaded`; } else if (c.items.length) {
      await db.bulkInsert(name, c.items); report[name] = `${c.items.length} imported from ${path.basename(c.file)}`;
    } else report[name] = 'empty';
  }
  return report;
}

module.exports = { ...collections, loadFromDb };

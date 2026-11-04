'use strict';
/**
 * Tiny JSON-file store. One file per collection under /storage.
 * Writes are atomic (temp file + rename). Fine for a single Node process.
 * To move to MySQL/Postgres later, keep this interface and swap the internals.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage');
fs.mkdirSync(DIR, { recursive: true });

class Collection {
  constructor(name) {
    this.file = path.join(DIR, `${name}.json`);
    this.items = [];
    try {
      this.items = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (e) {
      this.items = [];
    }
  }
  _save() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.items, null, 2));
    fs.renameSync(tmp, this.file);
  }
  all() { return this.items.slice(); }
  find(fn) { return this.items.find(fn); }
  filter(fn) { return this.items.filter(fn); }
  byId(id) { return this.items.find((i) => i.id === id); }
  insert(obj) {
    const rec = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...obj };
    this.items.push(rec);
    this._save();
    return rec;
  }
  update(id, patch) {
    const rec = this.byId(id);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    this._save();
    return rec;
  }
}

module.exports = {
  users: new Collection('users'),
  bookings: new Collection('bookings'),
  enquiries: new Collection('enquiries'),
  quotes: new Collection('quotes'),
};

#!/usr/bin/env node
'use strict';
// Usage:  node scripts/create-admin.js <username> "<Full Name>" <password> [admin|staff]
// admin = the system admin (sees everything). staff = Guests section only. The first login is always admin.
// Creates a team login, or resets the password if the username already exists.
require('../src/lib/env');
const bcrypt = require('bcryptjs');
const db = require('../src/lib/db');
const store = require('../src/lib/store');

const [username, name, password, roleArg] = process.argv.slice(2);
if (!username || !password || password.length < 10) {
  console.error('Usage: node scripts/create-admin.js <username> "<Full Name>" <password of 10+ characters>');
  process.exit(1);
}
(async () => {
  if (db.enabled) { await db.connect(); await store.loadFromDb(); }
  const u = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
const hash = bcrypt.hashSync(password, 10);
const existing = store.admins.find((a) => a.username === u);
if (existing) { store.admins.update(existing.id, { hash }); console.log(`Password reset for ${u}.`); } else {
  store.admins.insert({ username: u, name: name || u, hash, role: !store.admins.all().length || roleArg === 'admin' ? 'admin' : 'staff' });
  console.log(`Team login created: ${u}`);
}
  if (db.enabled) await db.close();
})().catch((e) => { console.error(e.message); process.exit(1); });

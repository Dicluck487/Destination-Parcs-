'use strict';
/**
 * The pictures that ship with the site (public/images). They are listed in the team area library.
 * Removing one moves the file to storage/trash so it can be brought back with Restore.
 * Brand files (logo, icons) are part of the design and cannot be removed.
 */
const fs = require('fs');
const path = require('path');
const content = require('./content');
const data = require('./data');

const ROOT = path.join(__dirname, '..', '..', 'public', 'images');
const TRASH = path.join(process.env.STORAGE_DIR || path.join(__dirname, '..', '..', 'storage'), 'trash');
const EXT = /\.(svg|png|jpe?g|webp|gif)$/i;
const GROUPS = { hero: 'Home banner slides', brand: 'Brand (logo and icons)' };
const nice = (f) => f.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

function scan(dir, base = '') {
  let out = [];
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  names.forEach((d) => {
    const rel = base ? `${base}/${d.name}` : d.name;
    if (d.isDirectory()) out = out.concat(scan(path.join(dir, d.name), rel));
    else if (EXT.test(d.name)) out.push(rel);
  });
  return out;
}

function heroKeyOf(rel) { const m = rel.match(/^hero\/([\w-]+)\.\w+$/); return m ? m[1] : ''; }

function usageOf(rel) {
  const url = `/images/${rel}`;
  const used = content.NAMES.filter((n) => JSON.stringify(content.get(n)).includes(url)).map((n) => content.LABELS[n]);
  const key = heroKeyOf(rel);
  if (key && (content.get('pages').hero || []).some((s) => s.key === key && !s.image && !s.video)) used.push('Home page banner');
  return Array.from(new Set(used));
}

function list() {
  return scan(ROOT).sort().map((rel) => {
    const top = rel.split('/')[0];
    let size = 0; try { size = fs.statSync(path.join(ROOT, rel)).size; } catch (e) { /* ignore */ }
    return { rel, url: `/images/${rel}`, title: nice(path.basename(rel)), group: GROUPS[top] || 'Other pictures', locked: top === 'brand', size, usedIn: usageOf(rel) };
  });
}

/** For the picker: everything except the brand files. */
const pickable = () => list().filter((i) => !i.locked).map((i) => ({ mid: `b:${i.rel}`, kind: 'image', linkKind: '', vid: '', url: i.url, thumb: i.url, title: `${i.title} (built-in)` }));

function trashed() {
  return scan(TRASH).sort().map((f) => ({ file: f, rel: f.replace(/__/g, '/'), title: nice(path.basename(f.replace(/__/g, '/'))) }));
}

function check(rel) {
  if (typeof rel !== 'string' || !/^[\w-]+\/[\w.-]+$/.test(rel) || !EXT.test(rel)) throw Object.assign(new Error('Unknown picture.'), { expose: true });
}

/** Move a built-in picture to the trash. Takes it out of the home banner if it was a banner slide. */
function remove(rel) {
  check(rel);
  const item = list().find((i) => i.rel === rel);
  if (!item) throw Object.assign(new Error('That picture was not found.'), { expose: true });
  if (item.locked) throw Object.assign(new Error('Brand pictures are part of the design and cannot be removed.'), { expose: true });
  const key = heroKeyOf(rel);
  if (key) {
    const pages = content.get('pages');
    const isThis = (s) => s.key === key && !s.image && !s.video;
    const left = (pages.hero || []).filter((s) => !isThis(s));
    if ((pages.hero || []).some(isThis)) {
      if (!left.length) throw Object.assign(new Error('This is the only banner slide. Add another slide in Home page first, then remove this picture.'), { expose: true });
      content.save('pages', { ...pages, hero: left }, `Removed the built-in banner picture "${item.title}"`);
      data.reload();
    }
  }
  fs.mkdirSync(TRASH, { recursive: true });
  fs.renameSync(path.join(ROOT, rel), path.join(TRASH, rel.replace(/\//g, '__')));
  return item;
}

function restore(file) {
  if (typeof file !== 'string' || !/^[\w-]+__[\w.-]+$/.test(file)) throw Object.assign(new Error('Unknown picture.'), { expose: true });
  const src = path.join(TRASH, file);
  if (!fs.existsSync(src)) throw Object.assign(new Error('That picture is no longer in the trash.'), { expose: true });
  const rel = file.replace(/__/g, '/');
  fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
  fs.renameSync(src, path.join(ROOT, rel));
  return rel;
}

module.exports = { list, pickable, trashed, remove, restore };

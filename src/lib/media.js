'use strict';
/**
 * Photo slots. Drop real photos into /public/images/... using these names and they appear
 * automatically; until then the site shows brand-styled artwork.
 *
 *   public/images/hero/<key>.jpg                forest | waterfront | families | campfire
 *   public/images/activities/<slug>.jpg         cover (4:3). Extra: <slug>-2.jpg ... <slug>-5.jpg
 *   public/images/types/<type-slug>.jpg         type cover
 *   public/images/destinations/<slug>.jpg       hero.  Gallery: <slug>-1.jpg ...
 *   public/images/breaks/<slug>.jpg             break / package cover
 *   public/images/pages/<name>.jpg              e.g. corporate, stay, plan, seasonal, experience
 *
 * Accepted extensions: jpg, jpeg, webp, png.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', 'public');
const EXT = ['jpg', 'jpeg', 'webp', 'png'];
const cache = new Map();

function find(rel) {
  if (cache.has(rel) && process.env.NODE_ENV === 'production') return cache.get(rel);
  let hit = null;
  for (const e of EXT) {
    if (fs.existsSync(path.join(ROOT, `${rel}.${e}`))) { hit = `/${rel}.${e}`; break; }
  }
  cache.set(rel, hit);
  return hit;
}

const photo = (dir, key) => find(`images/${dir}/${key}`);

function gallery(dir, key, max = 5) {
  const out = [];
  const first = find(`images/${dir}/${key}`);
  if (first) out.push(first);
  for (let i = 1; i <= max; i++) {
    const p = find(`images/${dir}/${key}-${i}`);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

function heroSlide(key) {
  return find(`images/hero/${key}`) || `/images/hero/${key}.svg`;
}

function list(dir) {
  try {
    return fs.readdirSync(path.join(ROOT, 'images', dir))
      .filter((f) => EXT.includes(f.split('.').pop().toLowerCase()))
      .sort().map((f) => `/images/${dir}/${f}`);
  } catch (e) { return []; }
}

/** Cover image: admin-chosen first, then the file-name convention. */
const cover = (entity, dir) => (entity && entity.cover) || (entity && entity.photos && entity.photos[0]) || photo(dir, entity && entity.slug);

/** All photos for an entity (admin-chosen list, else files named <slug>-1.jpg ...). */
function photos(entity, dir, max = 5) {
  const out = [];
  if (entity.cover) out.push(entity.cover);
  (entity.photos || []).forEach((p) => { if (!out.includes(p)) out.push(p); });
  if (!out.length) gallery(dir, entity.slug, max).forEach((p) => out.push(p));
  return out;
}

/** Page banner (corporate, stay, plan ...) from the admin, else public/images/pages/<name>.jpg */
function page(name) {
  const banners = (require('./data').pages || {}).banners || {};
  return banners[name] || find(`images/pages/${name}`);
}

/** Normalised gallery items (photos then videos) for the shared gallery partial. */
function items(entity, dir, max = 5) {
  const out = photos(entity, dir, max).map((src) => ({ type: 'image', src }));
  (entity.videos || []).forEach((v) => out.push({ type: v.kind, src: v.url || '', id: v.id || '', title: v.title || '' }));
  return out;
}

/** Small version of an uploaded image (falls back to the original). */
const thumb = (u) => (typeof u === 'string' && u.startsWith('/uploads/images/') ? u.replace('/uploads/images/', '/uploads/thumbs/') : u);

module.exports = { thumb, photo, gallery, heroSlide, list, cover, photos, page, items };

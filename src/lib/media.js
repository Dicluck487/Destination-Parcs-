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

module.exports = { photo, gallery, heroSlide, list };

'use strict';
/** Helpers that turn admin form posts into clean content. Everything from a form is untrusted. */
const { clean } = require('./util');

const str = (v, max = 400) => clean(typeof v === 'string' ? v : '', max);
const text = (v, max = 4000) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');
const bool = (v) => v === 'on' || v === 'true' || v === '1' || v === true || (Array.isArray(v) && v.includes('on'));
const num = (v, min, max, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt; };

/** qs turns long indexed lists into objects. Always get an array back. */
function arr(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') return Object.keys(x).sort((a, b) => Number(a) - Number(b)).map((k) => x[k]);
  return [];
}
const lines = (v, max = 400) => text(v, 8000).split('\n').map((l) => l.trim().slice(0, max)).filter(Boolean);
const paras = (v) => text(v, 12000).split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

const okPath = (u) => typeof u === 'string' && /^\/(uploads|images)\/[\w\-./]+$/.test(u) && !u.includes('..');
const okUpload = (u) => typeof u === 'string' && /^\/uploads\/(images|videos)\/[\w\-.]+$/.test(u);

function json(v, fallback) { try { return JSON.parse(v); } catch (e) { return fallback; } }

/** Single image URL from a hidden field. */
const image = (v) => { const u = typeof v === 'string' ? v.trim() : ''; return okPath(u) ? u : ''; };
const images = (v) => Array.from(new Set(arr(json(v, [])).filter(okPath)));
const videoFile = (v) => { const u = typeof v === 'string' ? v.trim() : ''; return okUpload(u) && u.includes('/videos/') ? u : ''; };

function video(o) {
  if (!o || typeof o !== 'object') return null;
  const title = str(o.title, 80);
  if (o.kind === 'file' && okUpload(o.url) && o.url.includes('/videos/')) return { kind: 'file', url: o.url, title };
  if (o.kind === 'youtube' && /^[\w-]{11}$/.test(o.id || '')) return { kind: 'youtube', id: o.id, url: `https://www.youtube.com/watch?v=${o.id}`, title };
  if (o.kind === 'vimeo' && /^\d{6,12}$/.test(o.id || '')) return { kind: 'vimeo', id: o.id, url: `https://vimeo.com/${o.id}`, title };
  return null;
}
const videos = (v) => arr(json(v, [])).map(video).filter(Boolean);

/** Mixed gallery (photos and videos with captions) used on the home page. */
function mixed(v, max = 12) {
  return arr(json(v, [])).map((o) => {
    if (!o || typeof o !== 'object') return null;
    const caption = str(o.caption, 80);
    if (o.type === 'image' && okPath(o.src)) return { type: 'image', src: o.src, caption };
    if (o.type === 'file' && okUpload(o.src) && o.src.includes('/videos/')) return { type: 'file', src: o.src, caption };
    if (o.type === 'youtube' && /^[\w-]{11}$/.test(o.id || '')) return { type: 'youtube', src: `https://www.youtube.com/watch?v=${o.id}`, id: o.id, caption };
    if (o.type === 'vimeo' && /^\d{6,12}$/.test(o.id || '')) return { type: 'vimeo', src: `https://vimeo.com/${o.id}`, id: o.id, caption };
    return null;
  }).filter(Boolean).slice(0, max);
}

/** Same-site link only (or http/https). */
const href = (v) => { const s = str(v, 300); return /^(\/(?!\/)[^\s]*|https?:\/\/[^\s]+)$/.test(s) ? s : ''; };
const url = (v) => { const s = str(v, 300); return /^https?:\/\/[^\s]+$/.test(s) ? s : ''; };

module.exports = { str, text, bool, num, arr, lines, paras, json, image, images, videoFile, videos, video, mixed, href, url, okPath };

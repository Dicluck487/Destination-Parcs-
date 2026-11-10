'use strict';
/**
 * Media library: image and video uploads plus YouTube / Vimeo links.
 * Files live in storage/uploads (UPLOAD_DIR to change). They are served at /uploads.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const store = require('./store');
const content = require('./content');

const ROOT = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'storage', 'uploads');
const DIRS = { images: path.join(ROOT, 'images'), thumbs: path.join(ROOT, 'thumbs'), videos: path.join(ROOT, 'videos') };
Object.values(DIRS).forEach((d) => fs.mkdirSync(d, { recursive: true }));

const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB) || 25;
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB) || 300;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const VIDEO_EXT = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };

const EXT_TYPE = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
/** Some browsers send video as application/octet-stream. Fall back to the extension. */
function typeOf(file) {
  if (IMAGE_TYPES.has(file.mimetype) || VIDEO_EXT[file.mimetype]) return file.mimetype;
  const e = path.extname(file.originalname || '').toLowerCase();
  if ((!file.mimetype || file.mimetype === 'application/octet-stream') && EXT_TYPE[e]) return EXT_TYPE[e];
  return null;
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaFile = (file) => {
  const h = crypto.createHash('sha256'); const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(4 * 1024 * 1024); let n;
  try { while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(b.subarray(0, n)); } finally { fs.closeSync(fd); }
  return h.digest('hex');
};
/** A file already in the library with the same content (and still on disk), so the same picture is never stored twice. */
function sameAs(hash) {
  const m = store.media.find((x) => x.hash === hash);
  if (!m) return null;
  const dir = m.kind === 'image' ? DIRS.images : DIRS.videos;
  return fs.existsSync(path.join(dir, path.basename(m.url))) ? { ...m, dup: true } : null;
}
const uid = () => `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
const niceName = (n) => String(n || 'Untitled').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 80) || 'Untitled';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, IMAGE_TYPES.has(file.mimetype) ? DIRS.images : DIRS.videos),
    filename: (req, file, cb) => cb(null, `${uid()}${IMAGE_TYPES.has(file.mimetype) ? '.upload' : VIDEO_EXT[file.mimetype] || '.bin'}`),
  }),
  limits: { fileSize: MAX_VIDEO_MB * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const t = typeOf(file);
    if (t) { file.mimetype = t; return cb(null, true); }
    const err = new Error(`"${file.originalname}" is not a supported file. Use JPG, PNG, WebP, GIF, AVIF, MP4, WebM or MOV.`);
    err.expose = true;
    return cb(err);
  },
}).array('files', 20);

/** Resize an uploaded image in place, make a thumbnail, and register it. */
async function registerImage(file, who) {
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    fs.unlinkSync(file.path);
    throw Object.assign(new Error(`"${file.originalname}" is larger than ${MAX_IMAGE_MB} MB.`), { expose: true });
  }
  const buf = fs.readFileSync(file.path);
  fs.unlinkSync(file.path);
  const hash = sha(buf);
  const had = sameAs(hash);
  if (had) return had;
  let meta;
  try { meta = await sharp(buf).metadata(); } catch (e) {
    throw Object.assign(new Error(`"${file.originalname}" could not be read as an image.`), { expose: true });
  }
  const ext = meta.hasAlpha ? 'webp' : 'jpg';
  const name = `${uid()}.${ext}`;
  const enc = (p) => (ext === 'webp' ? p.webp({ quality: 82 }) : p.jpeg({ quality: 82, mozjpeg: true }));
  const big = await enc(sharp(buf, { animated: false }).rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(DIRS.images, name), big.data);
  const small = await enc(sharp(buf, { animated: false }).rotate().resize({ width: 520, height: 520, fit: 'cover' })).toBuffer();
  fs.writeFileSync(path.join(DIRS.thumbs, name), small);
  return store.media.insert({
    kind: 'image', url: `/uploads/images/${name}`, thumb: `/uploads/thumbs/${name}`,
    title: niceName(file.originalname), size: big.data.length, width: big.info.width, height: big.info.height, by: who || '', hash,
  });
}

function registerVideo(file, who) {
  const head = Buffer.alloc(12);
  const fd = fs.openSync(file.path, 'r'); fs.readSync(fd, head, 0, 12, 0); fs.closeSync(fd);
  const isMp4 = head.slice(4, 8).toString() === 'ftyp';
  const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
  if (!(file.mimetype === 'video/webm' ? isWebm : isMp4)) {
    fs.unlinkSync(file.path);
    throw Object.assign(new Error(`"${file.originalname}" does not look like a real ${file.mimetype === 'video/webm' ? 'WebM' : 'MP4 or MOV'} video.`), { expose: true });
  }
  const hash = shaFile(file.path);
  const had = sameAs(hash);
  if (had) { fs.unlinkSync(file.path); return had; }
  return store.media.insert({
    kind: 'video', hash, url: `/uploads/videos/${path.basename(file.path)}`, thumb: '',
    title: niceName(file.originalname), size: file.size, mime: file.mimetype, by: who || '',
  });
}

/** Parse a YouTube or Vimeo link. Returns { linkKind, id, url } or null. */
function parseLink(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let m;
  if (host === 'youtu.be') m = u.pathname.match(/^\/([\w-]{11})/);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    if (!m && u.searchParams.get('v') && /^[\w-]{11}$/.test(u.searchParams.get('v'))) m = [null, u.searchParams.get('v')];
  }
  if (m) return { linkKind: 'youtube', id: m[1], url: `https://www.youtube.com/watch?v=${m[1]}` };
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    m = u.pathname.match(/(?:video\/|^\/)(\d{6,12})/);
    if (m) return { linkKind: 'vimeo', id: m[1], url: `https://vimeo.com/${m[1]}` };
  }
  return null;
}

function addLink(raw, title, who) {
  const p = parseLink(raw);
  if (!p) return null;
  const had = store.media.find((x) => x.kind === 'link' && x.url === p.url);
  if (had) return { ...had, dup: true };
  return store.media.insert({ kind: 'link', linkKind: p.linkKind, vid: p.id, url: p.url, thumb: '', title: String(title || '').slice(0, 80) || (p.linkKind === 'youtube' ? 'YouTube video' : 'Vimeo video'), by: who || '' });
}

/** Which content sets mention this URL? */
function usageOf(url) {
  return content.NAMES.filter((n) => JSON.stringify(content.get(n)).includes(url)).map((n) => content.LABELS[n]);
}

/** Take a deleted file out of every content set so no page is left with a broken picture. */
function scrubUsage(url) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.filter((x) => !(x === url || (x && typeof x === 'object' && (x.url === url || x.src === url)))).map(walk);
    if (node && typeof node === 'object') { Object.keys(node).forEach((k) => { node[k] = node[k] === url ? '' : walk(node[k]); }); }
    return node;
  };
  content.NAMES.forEach((n) => {
    const cur = content.get(n);
    if (JSON.stringify(cur).includes(url)) content.save(n, walk(cur), 'Removed a deleted photo or video');
  });
}

function remove(rec) {
  if (rec.kind === 'image') {
    [path.join(DIRS.images, path.basename(rec.url)), path.join(DIRS.thumbs, path.basename(rec.url))].forEach((f) => { try { fs.unlinkSync(f); } catch (e) { /* already gone */ } });
  } else if (rec.kind === 'video') {
    try { fs.unlinkSync(path.join(DIRS.videos, path.basename(rec.url))); } catch (e) { /* already gone */ }
  }
  return store.media.remove(rec.id);
}

module.exports = { ROOT, upload, registerImage, registerVideo, parseLink, addLink, usageOf, scrubUsage, remove, MAX_IMAGE_MB, MAX_VIDEO_MB };

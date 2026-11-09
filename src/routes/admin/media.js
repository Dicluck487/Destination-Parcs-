'use strict';
const express = require('express');
const store = require('../../lib/store');
const uploads = require('../../lib/uploads');
const builtin = require('../../lib/builtin');
const { flash, clean } = require('../../lib/util');

const router = express.Router();

// Library page
router.get('/', (req, res) => {
  const kind = ['image', 'video', 'link'].includes(req.query.kind) ? req.query.kind : '';
  const q = clean(req.query.q, 60).toLowerCase();
  const all = store.media.all().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const items = all.filter((m) => (!kind || m.kind === kind) && (!q || m.title.toLowerCase().includes(q)));
  res.render('admin/media', {
    pageTitle: 'Photos & videos', items: items.map((m) => ({ ...m, usedIn: uploads.usageOf(m.url) })), kind, q,
    totals: { image: all.filter((m) => m.kind === 'image').length, video: all.filter((m) => m.kind === 'video').length, link: all.filter((m) => m.kind === 'link').length },
    limits: { image: uploads.MAX_IMAGE_MB, video: uploads.MAX_VIDEO_MB },
    builtin: (!kind || kind === 'image') ? builtin.list().filter((b) => !q || b.title.toLowerCase().includes(q)) : [],
    trashed: builtin.trashed(),
  });
});

// JSON for the picker
router.get('/list.json', (req, res) => {
  const want = String(req.query.kinds || 'image,video,link').split(',');
  const q = clean(req.query.q, 60).toLowerCase();
  const items = store.media.all().filter((m) => want.includes(m.kind) && (!q || m.title.toLowerCase().includes(q)))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 300);
  const mine = items.map((m) => ({ mid: m.id, kind: m.kind, linkKind: m.linkKind || '', vid: m.vid || '', url: m.url, thumb: m.thumb || '', title: m.title }));
  const built = want.includes('image') ? builtin.pickable().filter((m) => !q || m.title.toLowerCase().includes(q)) : [];
  res.json({ items: mine.concat(built) });
});

// Upload one or many files (multipart; the CSRF token comes in the X-CSRF-Token header)
router.post('/upload', (req, res) => {
  uploads.upload(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `That file is too large. Videos can be up to ${uploads.MAX_VIDEO_MB} MB.` : (err.expose ? err.message : 'The upload did not work. Please try again.');
      return res.status(400).json({ error: msg });
    }
    const out = []; const errors = [];
    for (const f of req.files || []) {
      try {
        const rec = f.mimetype.startsWith('image/') ? await uploads.registerImage(f, res.locals.adminUser.username) : uploads.registerVideo(f, res.locals.adminUser.username);
        out.push({ mid: rec.id, kind: rec.kind, linkKind: '', vid: '', url: rec.url, thumb: rec.thumb, title: rec.title });
      } catch (e) { errors.push(e.expose ? e.message : `"${f.originalname}" could not be saved.`); }
    }
    return res.status(out.length || !errors.length ? 200 : 400).json({ items: out, errors });
  });
});

// Add a YouTube or Vimeo link
router.post('/link', (req, res) => {
  const rec = uploads.addLink(req.body.url, clean(req.body.title, 80), res.locals.adminUser.username);
  if (!rec) return res.status(400).json({ error: 'That does not look like a YouTube or Vimeo link.' });
  return res.json({ items: [{ mid: rec.id, kind: 'link', linkKind: rec.linkKind, vid: rec.vid, url: rec.url, thumb: '', title: rec.title }] });
});

// Built-in pictures: remove (to the trash) and restore
router.post('/builtin/delete', (req, res) => {
  try { const it = builtin.remove(String(req.body.rel || '')); flash(req, 'success', `"${it.title}" removed. You can bring it back from "Removed built-in pictures" below.`); } catch (e) { flash(req, 'error', e.expose ? e.message : 'That picture could not be removed.'); }
  res.redirect('/admin/media');
});
router.post('/builtin/restore', (req, res) => {
  try { builtin.restore(String(req.body.file || '')); flash(req, 'success', 'Picture restored.'); } catch (e) { flash(req, 'error', e.expose ? e.message : 'That picture could not be restored.'); }
  res.redirect('/admin/media');
});

router.post('/:id/rename', (req, res) => {
  const t = clean(req.body.title, 80);
  if (t && store.media.byId(req.params.id)) store.media.update(req.params.id, { title: t });
  flash(req, 'success', 'Renamed.');
  res.redirect(req.get('referer') || '/admin/media');
});

router.post('/:id/delete', (req, res) => {
  const rec = store.media.byId(req.params.id);
  if (!rec) return res.redirect('/admin/media');
  const used = uploads.usageOf(rec.url);
  if (used.length && req.body.force !== '1') {
    flash(req, 'error', `"${rec.title}" is used in: ${used.join(', ')}. Remove it there first, or use Delete in the library and confirm to take it out of those pages as well.`);
    return res.redirect('/admin/media');
  }
  if (used.length) { uploads.scrubUsage(rec.url); require('../../lib/data').reload(); }
  uploads.remove(rec);
  flash(req, 'success', `"${rec.title}" deleted.`);
  return res.redirect('/admin/media');
});

module.exports = router;

'use strict';
const express = require('express');
const d = require('../lib/data');

const router = express.Router();

router.get('/', (req, res) => {
  const items = req.session.trip.map((s) => d.actBySlug[s]).filter(Boolean);
  res.render('pages/trip', { pageTitle: 'My trip', items, activeNav: 'things-to-do' });
});

function respond(req, res) {
  const wantsJson = req.is('json') || (req.get('accept') || '').includes('application/json');
  if (wantsJson) return res.json({ ok: true, count: req.session.trip.length, trip: req.session.trip });
  const back = req.get('referer') || '/trip';
  return res.redirect(back);
}

router.post('/add', (req, res) => {
  const slug = String(req.body.slug || '');
  if (d.actBySlug[slug] && !req.session.trip.includes(slug) && req.session.trip.length < 40) req.session.trip = [...req.session.trip, slug];
  respond(req, res);
});

router.post('/remove', (req, res) => {
  const slug = String(req.body.slug || '');
  req.session.trip = req.session.trip.filter((s) => s !== slug);
  respond(req, res);
});

router.post('/clear', (req, res) => { req.session.trip = []; respond(req, res); });

// Load a package's activities into the trip
router.post('/package', (req, res) => {
  const b = d.breakBySlug[String(req.body.slug || '')];
  if (b) {
    const add = b.inclusions.filter((i) => i.slug).map((i) => i.slug);
    req.session.trip = Array.from(new Set([...req.session.trip, ...add]));
  }
  res.redirect(`/book${b ? `?break=${b.slug}` : ''}`);
});

module.exports = router;

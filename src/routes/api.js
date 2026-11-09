'use strict';
const express = require('express');
const d = require('../lib/data');
const av = require('../lib/availability');

const router = express.Router();

router.get('/availability', (req, res) => {
  const slug = String(req.query.type || '');
  const ym = String(req.query.month || av.today().slice(0, 7));
  const opt = d.stayBySlug[slug];
  if (!opt || !opt.units || !/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return res.status(400).json({ error: 'Bad request' });
  res.set('Cache-Control', 'no-store');
  return res.json(av.month(slug, ym));
});

router.get('/check', (req, res) => {
  const slug = String(req.query.slug || '');
  const nights = parseInt(req.query.nights, 10) || 0;
  const units = parseInt(req.query.units, 10) || 1;
  const checkIn = String(req.query.checkIn || '');
  if (!d.stayBySlug[slug] || !av.validDate(checkIn) || nights < 1) return res.json({ ok: null });
  return res.json({ ok: av.fits(slug, checkIn, nights, units) });
});

module.exports = router;

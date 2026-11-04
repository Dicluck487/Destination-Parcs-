'use strict';
const express = require('express');
const d = require('../lib/data');
const media = require('../lib/media');

const router = express.Router();
const base = { activeNav: 'breaks' };

const hydrateList = (list) => list.map((b) => d.breakBySlug[b.slug]);

router.get('/', (req, res) => {
  res.render('pages/breaks', {
    ...base, pageTitle: 'Breaks & Packages',
    seasonal: hydrateList(d.breaks.seasonal), family: hydrateList(d.breaks.other), signature: hydrateList(d.breaks.signature),
    durations: d.DURATIONS,
  });
});

const groupPage = (title, lead, key, extra = {}) => (req, res) => {
  res.render('pages/break-group', { ...base, pageTitle: title, lead, list: hydrateList(d.breaks[key]), ...extra });
};
router.get('/seasonal', groupPage('Seasonal Breaks', 'Festive and special-occasion breaks timed around the calendar.', 'seasonal', { eyebrow: 'Seasonal' }));
router.get('/family', groupPage('Family & Child-Friendly Breaks', 'Easy, flexible breaks for families and parents with young children.', 'other', { eyebrow: 'Family' }));
router.get('/signature', groupPage('Signature Experiences', 'Six hand-built packages that capture the feel of Destination Parcs.', 'signature', { eyebrow: 'Signature' }));

router.get('/durations', (req, res) => res.render('pages/durations', { ...base, pageTitle: 'Break Durations', durations: d.DURATIONS }));

router.get('/:slug', (req, res, next) => {
  const b = d.breakBySlug[req.params.slug];
  if (!b) return next();
  res.render('pages/break', {
    ...base, pageTitle: b.name, brk: b, metaDescription: b.blurb,
    cover: media.photo('breaks', b.slug),
    others: d.allBreaks.filter((x) => x.kind === b.kind && x.slug !== b.slug).slice(0, 3),
  });
});

module.exports = router;

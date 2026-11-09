'use strict';
const express = require('express');
const d = require('../lib/data');

const router = express.Router();
const base = { activeNav: 'stay' };
const bookable = () => d.stayOptions.filter((s) => s.units > 0);

router.get('/', (req, res) => res.render('pages/stay', { ...base, pageTitle: 'Accommodation', options: bookable() }));
router.get('/rooms', (req, res) => res.render('pages/rooms', { ...base, pageTitle: 'Room Types & Rates', options: bookable().filter((s) => s.kind === 'room') }));
router.get('/availability', (req, res) => {
  const list = bookable();
  const slug = list.find((s) => s.slug === req.query.type) ? req.query.type : (list[0] || {}).slug;
  res.render('pages/availability', { ...base, pageTitle: 'Availability Calendar', options: list, slug, extraScripts: ['/js/calendar.js'] });
});
router.get('/camping-and-glamping', (req, res) => res.render('pages/camping', { ...base, pageTitle: 'Camping or Glamping', options: bookable().filter((s) => ['camping', 'glamping'].includes(s.kind)) }));

module.exports = router;

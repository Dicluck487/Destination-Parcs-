'use strict';
const crypto = require('crypto');
const express = require('express');
const store = require('../lib/store');
const { flash, clean, limiter, STATUS_LABEL } = require('../lib/util');

const router = express.Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const guard = (req, res, next) => {
  if (!ADMIN_PASSWORD) return res.status(404).render('pages/error', { pageTitle: 'Not found', code: 404, message: 'The admin area is switched off. Set ADMIN_PASSWORD to enable it.' });
  if (req.session.admin) return next();
  return res.redirect('/admin/login');
};

router.get('/login', (req, res) => {
  if (!ADMIN_PASSWORD) return guard(req, res, () => {});
  res.render('pages/admin-login', { pageTitle: 'Team sign in', layout: 'layouts/admin' });
});
router.post('/login', limiter(8), (req, res) => {
  if (ADMIN_PASSWORD && same(String(req.body.password || ''), ADMIN_PASSWORD)) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  flash(req, 'error', 'Wrong password.');
  return res.redirect('/admin/login');
});
router.post('/logout', (req, res) => { req.session.admin = false; res.redirect('/admin/login'); });

router.get('/', guard, (req, res) => {
  const bookings = store.bookings.all().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const enquiries = store.enquiries.all().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const quotes = store.quotes.all().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.render('pages/admin', {
    pageTitle: 'Team dashboard', layout: 'layouts/admin', bookings, enquiries, quotes, STATUS_LABEL,
    users: store.users.all().length,
    tab: ['bookings', 'enquiries', 'quotes'].includes(req.query.tab) ? req.query.tab : 'bookings',
  });
});

router.post('/bookings/:id/status', guard, (req, res) => {
  const status = String(req.body.status || '');
  if (Object.keys(STATUS_LABEL).includes(status)) store.bookings.update(req.params.id, { status, adminNote: clean(req.body.note, 500) });
  res.redirect('/admin?tab=bookings');
});
router.post('/enquiries/:id/status', guard, (req, res) => {
  store.enquiries.update(req.params.id, { status: req.body.status === 'done' ? 'done' : 'new' });
  res.redirect('/admin?tab=enquiries');
});
router.post('/quotes/:id/status', guard, (req, res) => {
  store.quotes.update(req.params.id, { status: req.body.status === 'done' ? 'done' : 'new' });
  res.redirect('/admin?tab=quotes');
});

module.exports = router;

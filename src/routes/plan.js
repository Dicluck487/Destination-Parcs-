'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../lib/store');
const av = require('../lib/availability');
const { flash, clean, isEmail, normPhone, isPhone, requireUser, safeNext, limiter, STATUS_LABEL } = require('../lib/util');

const router = express.Router();
const base = { activeNav: '' };

const findByLogin = (login) => {
  const l = clean(login, 150).toLowerCase();
  const p = normPhone(login);
  return store.users.find((u) => (u.email && u.email === l) || (u.phone && p && u.phone === p));
};

router.get('/signin', (req, res) => {
  if (res.locals.user) return res.redirect(safeNext(req.query.next));
  res.render('pages/signin', { ...base, pageTitle: 'Sign in', next: safeNext(req.query.next), mode: 'signin' });
});

router.post('/signin', limiter(20), async (req, res) => {
  const user = findByLogin(req.body.login || '');
  const ok = user && await bcrypt.compare(String(req.body.password || ''), user.passwordHash);
  if (!ok) {
    flash(req, 'error', 'We could not match that email or phone and password.');
    return res.redirect(`/account/signin?next=${encodeURIComponent(safeNext(req.body.next))}`);
  }
  req.session.userId = user.id;
  flash(req, 'success', `Welcome back, ${user.name.split(' ')[0]}.`);
  return res.redirect(safeNext(req.body.next));
});

router.get('/register', (req, res) => {
  if (res.locals.user) return res.redirect('/account/bookings');
  res.render('pages/signin', { ...base, pageTitle: 'Create your account', next: safeNext(req.query.next), mode: 'register', form: req.session.form || {} });
  req.session.form = null;
});

router.post('/register', limiter(10), async (req, res) => {
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 150).toLowerCase();
  const phone = normPhone(req.body.phone);
  const password = String(req.body.password || '');
  const next = safeNext(req.body.next);
  const back = `/account/register?next=${encodeURIComponent(next)}`;
  req.session.form = { name, email, phone };
  const fail = (m) => { flash(req, 'error', m); return res.redirect(back); };
  if (!name) return fail('Please enter your name.');
  if (!email && !phone) return fail('Please add an email or a phone number.');
  if (email && !isEmail(email)) return fail('That email address does not look right.');
  if (phone && !isPhone(phone)) return fail('That phone number does not look right.');
  if (password.length < 8) return fail('Choose a password of at least 8 characters.');
  if ((email && store.users.find((u) => u.email === email)) || (phone && store.users.find((u) => u.phone === phone))) {
    return fail('An account with those details already exists. Try signing in.');
  }
  const user = store.users.insert({ name, email, phone, passwordHash: await bcrypt.hash(password, 10), saved: { adults: 2, children: 0, notes: '' } });
  req.session.userId = user.id;
  req.session.form = null;
  flash(req, 'success', 'Your account is ready.');
  return res.redirect(next);
});

router.post('/signout', (req, res) => {
  req.session.userId = null;
  flash(req, 'success', 'You have been signed out.');
  res.redirect('/');
});

// ---- My Bookings
const mine = (req, res) => store.bookings.filter((b) => b.userId === res.locals.user.id)
  .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));

router.get('/bookings', requireUser, (req, res) => {
  const all = mine(req, res);
  const t = av.today();
  const isPast = (b) => av.addDays(b.checkIn, Math.max(b.nights, 0)) < t || b.status === 'cancelled';
  res.render('pages/bookings', {
    ...base, pageTitle: 'My bookings',
    upcoming: all.filter((b) => !isPast(b)).reverse(),
    past: all.filter(isPast),
    STATUS_LABEL,
  });
});

router.get('/bookings/:ref', requireUser, (req, res, next) => {
  const b = mine(req, res).find((x) => x.ref === req.params.ref);
  if (!b) return next();
  res.render('pages/booking', { ...base, pageTitle: `Booking ${b.ref}`, b, STATUS_LABEL });
});

router.post('/bookings/:ref/request', requireUser, limiter(15), (req, res, next) => {
  const b = mine(req, res).find((x) => x.ref === req.params.ref);
  if (!b) return next();
  const type = req.body.type === 'cancel' ? 'cancel' : 'change';
  const message = clean(req.body.message, 1000);
  if (b.status === 'cancelled') {
    flash(req, 'error', 'This booking is already cancelled.');
    return res.redirect(`/account/bookings/${b.ref}`);
  }
  if (type === 'change' && !message) {
    flash(req, 'error', 'Please tell us what you would like to change.');
    return res.redirect(`/account/bookings/${b.ref}`);
  }
  const requests = [...(b.requests || []), { type, message, at: new Date().toISOString() }];
  store.bookings.update(b.id, { requests, status: type === 'cancel' ? 'cancel_requested' : 'change_requested' });
  flash(req, 'success', type === 'cancel' ? 'Cancellation request sent. Our team will confirm it.' : 'Change request sent. Our team will get back to you.');
  return res.redirect(`/account/bookings/${b.ref}`);
});

// ---- Saved details
router.get('/details', requireUser, (req, res) => {
  res.render('pages/details', { ...base, pageTitle: 'Saved details' });
});

router.post('/details', requireUser, limiter(20), async (req, res) => {
  const u = res.locals.user;
  const name = clean(req.body.name, 100);
  const email = clean(req.body.email, 150).toLowerCase();
  const phone = normPhone(req.body.phone);
  const adults = Math.max(1, Math.min(60, parseInt(req.body.adults, 10) || 1));
  const children = Math.max(0, Math.min(60, parseInt(req.body.children, 10) || 0));
  const notes = clean(req.body.notes, 500);
  const fail = (m) => { flash(req, 'error', m); return res.redirect('/account/details'); };
  if (!name) return fail('Please enter your name.');
  if (!email && !phone) return fail('Keep at least an email or a phone number.');
  if (email && !isEmail(email)) return fail('That email address does not look right.');
  if (phone && !isPhone(phone)) return fail('That phone number does not look right.');
  if ((email && store.users.find((x) => x.id !== u.id && x.email === email)) || (phone && store.users.find((x) => x.id !== u.id && x.phone === phone))) {
    return fail('Another account already uses those details.');
  }
  const patch = { name, email, phone, saved: { adults, children, notes } };
  if (req.body.password) {
    if (String(req.body.password).length < 8) return fail('A new password must be at least 8 characters.');
    patch.passwordHash = await bcrypt.hash(String(req.body.password), 10);
  }
  store.users.update(u.id, patch);
  flash(req, 'success', 'Your details have been saved.');
  return res.redirect('/account/details');
});

module.exports = router;

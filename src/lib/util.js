'use strict';
const rateLimit = require('express-rate-limit');

const flash = (req, type, text) => { req.session.flash = { type, text }; };

const clean = (v, max = 500) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max) : '');

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const normPhone = (s) => {
  const raw = clean(s, 30).replace(/[\s()-]/g, '');
  if (!raw) return '';
  if (/^0\d{9}$/.test(raw)) return `+256${raw.slice(1)}`; // Ugandan local format
  return raw;
};
const isPhone = (s) => /^\+?\d{9,15}$/.test(s);

function requireUser(req, res, next) {
  if (res.locals.user) return next();
  const target = req.originalUrl;
  flash(req, 'info', 'Please sign in to continue.');
  return res.redirect(`/account/signin?next=${encodeURIComponent(target)}`);
}

// Only allow same-site relative redirects
const safeNext = (n) => (typeof n === 'string' && /^\/(?!\/)[^\s]*$/.test(n) ? n : '/account/bookings');

const limiter = (max, windowMin = 15) => rateLimit({
  windowMs: windowMin * 60 * 1000,
  limit: max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    flash(req, 'error', 'Too many attempts. Please wait a few minutes and try again.');
    res.redirect(req.get('referer') || '/');
  },
});

function bookingRef() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return `DP-${s}`;
}

const STATUS_LABEL = {
  pending: 'Request received',
  confirmed: 'Confirmed',
  change_requested: 'Change requested',
  cancel_requested: 'Cancellation requested',
  cancelled: 'Cancelled',
};

module.exports = { flash, clean, isEmail, normPhone, isPhone, requireUser, safeNext, limiter, bookingRef, STATUS_LABEL };

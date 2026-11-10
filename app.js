'use strict';
require('./src/lib/env');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const compression = require('compression');
const cookieSession = require('cookie-session');

const data = require('./src/lib/data');
const nav = require('./src/lib/nav');  // a function: called per request
const media = require('./src/lib/media');
const { icon } = require('./src/lib/icons');
const store = require('./src/lib/store');
const uploads = require('./src/lib/uploads');

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

if (isProd) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
      'media-src': ["'self'", 'blob:'],
      'frame-src': ["'self'", 'https://www.openstreetmap.org', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'upgrade-insecure-requests': isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'same-origin' },
}));
app.use(compression());
app.use(express.urlencoded({ extended: true, limit: '2mb', parameterLimit: 5000 }));
app.use(express.json({ limit: '100kb' }));

const SESSION_SECRET = process.env.SESSION_SECRET || (isProd ? null : 'dev-only-secret-change-me');
if (!SESSION_SECRET) {
  console.error('SESSION_SECRET must be set in production.');
  process.exit(1);
}
app.use(cookieSession({
  name: 'dp.sid',
  keys: [SESSION_SECRET],
  maxAge: 1000 * 60 * 60 * 24 * 14,
  httpOnly: true,
  sameSite: 'lax',
  secure: false, // decided per request below, so a proxy that hides https cannot silently drop the cookie
}));

app.use((req, res, next) => { req.sessionOptions.secure = isProd && process.env.COOKIE_SECURE !== 'false' && req.secure; next(); });

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));
// Photos and videos uploaded from the team area. Long cache: file names are unique.
app.use('/uploads', express.static(uploads.ROOT, { maxAge: isProd ? '30d' : 0, immutable: isProd, index: false, fallthrough: true }));

// "Edit this page" shortcut shown to signed-in team members on the public site

// ---- per-request locals
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  req.session.trip = Array.isArray(req.session.trip) ? req.session.trip : [];
  res.locals.user = req.session.userId ? store.users.byId(req.session.userId) || null : null;
  if (req.session.userId && !res.locals.user) req.session.userId = null;
  res.locals.csrf = req.session.csrf;
  res.locals.flash = req.session.flash || null;
  req.session.flash = null;
  res.locals.trip = req.session.trip;
  res.locals.path = req.path;
  res.locals.query = req.query;
  res.locals.canonical = BASE_URL + req.path;
  res.locals.baseUrl = BASE_URL;
  // /css/main.css?v=<file time>: browsers fetch a fresh copy whenever a stylesheet or script changes
  res.locals.asset = (p) => { try { return `${p}?v=${Math.floor(fs.statSync(path.join(__dirname, 'public', p)).mtimeMs / 1000)}`; } catch (e) { return p; } };
  res.locals.pageKey = req.path.replace(/\/+$/, '') || '/';
  res.locals.hubCards = (name) => require('./src/lib/hubs').get(name);
  res.locals.activeNav = '';
  res.locals.pageTitle = '';
  res.locals.site = data.site;           // read per request so admin edits show at once
  res.locals.nav = nav();
  res.locals.metaDescription = data.site.description;
  res.locals.isAdmin = false; // the public pages never show anything from the team area
  res.locals.editLink = '';
  res.locals.ogImage = `${BASE_URL}/images/brand/og.jpg`;
  res.locals.bodyClass = '';
  res.locals.jsonLd = null;
  res.locals.extraScripts = [];
  next();
});

Object.assign(app.locals, {
  site: data.site, data, icon, media,
  year: new Date().getFullYear(),
  toneOf: (a) => a.tone || 'leaf',
  pluralise: (n, one, many) => `${n} ${n === 1 ? one : many}`,
  fmtDate: (s) => {
    if (!s) return '';
    const d = new Date(`${s}T00:00:00Z`);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  },
  fmtDateTime: (s) => new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
});

// CSRF for every state-changing request
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (sent && req.session.csrf && sent.length === req.session.csrf.length &&
      crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(req.session.csrf))) return next();
  if (req.is('json') || req.path.startsWith('/api/')) return res.status(403).json({ error: 'Invalid or missing security token. Refresh the page and try again.' });
  const back = req.path.startsWith('/admin') ? '/admin/login' : (req.get('referer') || '/');
  req.session.flash = { type: 'error', text: 'Your session expired, or your browser is blocking cookies. Please try again.' };
  return res.redirect(back);
});

// ---- routes
app.use('/', require('./src/routes/pages'));
app.use('/things-to-do', require('./src/routes/activities'));
app.use('/trip', require('./src/routes/trip'));
app.use('/stay', require('./src/routes/stay'));
app.use('/breaks', require('./src/routes/breaks'));
app.use('/corporate', require('./src/routes/corporate'));
app.use('/plan-your-visit', require('./src/routes/plan'));
app.use('/account', require('./src/routes/account'));
app.use('/book', require('./src/routes/booking'));
app.use('/api', require('./src/routes/api'));
app.use('/admin', require('./src/routes/admin/index'));
app.use('/', require('./src/routes/seo'));

// ---- errors
app.use((req, res) => {
  res.status(404).render('pages/error', { pageTitle: 'Page not found', code: 404, message: 'We could not find that page. It may have moved, or the link may be wrong.' });
});
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (res.headersSent) return;
  res.status(500).render('pages/error', { pageTitle: 'Something went wrong', code: 500, message: 'Something went wrong on our side. Please try again in a moment.' });
});

module.exports = { app, PORT, BASE_URL };

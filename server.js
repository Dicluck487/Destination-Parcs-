'use strict';
require('./src/lib/env');

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const compression = require('compression');
const cookieSession = require('cookie-session');

const data = require('./src/lib/data');
const nav = require('./src/lib/nav');
const media = require('./src/lib/media');
const { icon } = require('./src/lib/icons');
const store = require('./src/lib/store');

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
      'img-src': ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
      'frame-src': ["'self'", 'https://www.openstreetmap.org'],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'upgrade-insecure-requests': isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
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
  secure: isProd && process.env.COOKIE_SECURE !== 'false',
}));

app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '7d' : 0 }));

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
  res.locals.activeNav = '';
  res.locals.pageTitle = '';
  res.locals.metaDescription = data.site.description;
  res.locals.ogImage = `${BASE_URL}/images/brand/og.jpg`;
  res.locals.bodyClass = '';
  res.locals.jsonLd = null;
  res.locals.extraScripts = [];
  next();
});

Object.assign(app.locals, {
  site: data.site, nav, data, icon, media,
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
  req.session.flash = { type: 'error', text: 'Your session expired. Please try again.' };
  return res.redirect(req.get('referer') || '/');
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
app.use('/admin', require('./src/routes/admin'));
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

if (require.main === module) {
  app.listen(PORT, () => console.log(`Destination Parcs running at ${BASE_URL}`));
}
module.exports = app;

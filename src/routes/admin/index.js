'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const store = require('../../lib/store');
const content = require('../../lib/content');
const data = require('../../lib/data');
const { flash, clean, limiter, safeNext, STATUS_LABEL } = require('../../lib/util');

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';
const ENV_PASSWORD = process.env.ADMIN_PASSWORD || '';

// ---- accounts. ADMIN_PASSWORD creates (and, if changed, resets) the default "admin" login.
function seedAdmin() {
  if (!ENV_PASSWORD) return;
  const existing = store.admins.find((a) => a.seeded);
  if (!existing) {
    if (!store.admins.find((a) => a.username === 'admin')) {
      store.admins.insert({ username: 'admin', name: 'Administrator', hash: bcrypt.hashSync(ENV_PASSWORD, 10), seeded: true });
    }
  } else if (!bcrypt.compareSync(ENV_PASSWORD, existing.hash)) {
    store.admins.update(existing.id, { hash: bcrypt.hashSync(ENV_PASSWORD, 10) });
  }
}
seedAdmin();
const canSetup = () => !store.admins.all().length && (!isProd || process.env.ALLOW_SETUP === '1');

router.use((req, res, next) => {
  res.locals.layout = 'layouts/admin';
  res.locals.adminUser = null;
  res.locals.adminNav = null;
  res.locals.pageTitle = 'Team area';
  res.locals.STATUS_LABEL = STATUS_LABEL;
  next();
});


// Team sign-in lasts only while the team member is active: it ends after ADMIN_IDLE_MINUTES
// without a click (default 30) and after ADMIN_MAX_HOURS in total (default 8).
const IDLE_MS = (Number(process.env.ADMIN_IDLE_MINUTES) || 30) * 60 * 1000;
const MAX_MS = (Number(process.env.ADMIN_MAX_HOURS) || 8) * 60 * 60 * 1000;
// Roles: one system admin sees everything; other team members (staff) see only the Guests section.
// Accounts made before roles existed: the oldest login becomes the system admin, the rest become staff.
function ensureRoles() {
  const all = store.admins.all();
  if (!all.length || all.some((a) => a.role === 'admin')) { all.filter((a) => !a.role).forEach((a) => store.admins.update(a.id, { role: 'staff' })); return; }
  const first = all.slice().sort((a, b) => (a.createdAt || '') < (b.createdAt || '') ? -1 : 1)[0];
  all.forEach((a) => store.admins.update(a.id, { role: a.id === first.id ? 'admin' : 'staff' }));
}
const isSystem = (a) => !!a && a.role === 'admin';
const STAFF_OK = /^\/(bookings|enquiries|quotes)(\/|$)|^\/team$|^\/team\/password$/;
function startSession(req, id) { req.session.adminId = id; req.session.adminSince = Date.now(); req.session.adminAt = Date.now(); }
function endSession(req) { req.session.adminId = null; req.session.adminSince = null; req.session.adminAt = null; }
function currentAdmin(req) {
  const id = req.session.adminId;
  if (!id) return null;
  const now = Date.now();
  if (!req.session.adminAt || now - req.session.adminAt > IDLE_MS || !req.session.adminSince || now - req.session.adminSince > MAX_MS) { endSession(req); return null; }
  return store.admins.byId(id) || null;
}

router.get('/login', (req, res) => {
  if (currentAdmin(req)) return res.redirect('/admin');
  res.render('admin/login', { pageTitle: 'Team sign in', setup: canSetup(), noAccounts: !store.admins.all().length, next: safeNext(req.query.next) === '/account/bookings' ? '' : safeNext(req.query.next) });
});

router.post('/login', limiter(10), async (req, res) => {
  const username = clean(req.body.username, 40).toLowerCase();
  const a = store.admins.find((x) => x.username === username);
  const ok = a ? await bcrypt.compare(String(req.body.password || ''), a.hash) : await bcrypt.compare('x', '$2a$10$abcdefghijklmnopqrstuuYhq9k0rKjv1UJ9YQyH0j2oIZ2a6x0hK');
  if (!a || !ok) {
    flash(req, 'error', 'That username or password is not right.');
    return res.redirect('/admin/login');
  }
  startSession(req, a.id);
  store.admins.update(a.id, { lastLogin: new Date().toISOString() });
  const nxt = safeNext(req.body.next);
  return res.redirect(nxt.startsWith('/admin') ? nxt : '/admin');
});

router.post('/setup', limiter(5), async (req, res) => {
  if (!canSetup()) return res.redirect('/admin/login');
  const username = clean(req.body.username, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const pw = String(req.body.password || '');
  if (username.length < 3 || pw.length < 10) {
    flash(req, 'error', 'Choose a username of at least 3 characters and a password of at least 10.');
    return res.redirect('/admin/login');
  }
  const a = store.admins.insert({ username, name: clean(req.body.name, 80) || username, hash: await bcrypt.hash(pw, 10), role: 'admin' });
  startSession(req, a.id);
  return res.redirect('/admin');
});

router.post('/logout', (req, res) => { endSession(req); res.redirect('/admin/login'); });

// ---- everything below needs a signed-in team member
router.use((req, res, next) => {
  ensureRoles();
  const a = currentAdmin(req);
  if (!a) return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
  req.session.adminAt = Date.now();
  res.locals.adminUser = a;
  res.locals.isSystemAdmin = isSystem(a);
  if (!isSystem(a) && !STAFF_OK.test(req.path)) {
    if (req.method !== 'GET') return res.status(403).send('Not allowed');
    return res.redirect('/admin/bookings');
  }
  res.locals.adminPath = req.path;
  res.locals.badges = {
    bookings: store.bookings.filter((b) => ['pending', 'change_requested', 'cancel_requested'].includes(b.status)).length,
    enquiries: store.enquiries.filter((e) => e.status === 'new').length,
    quotes: store.quotes.filter((e) => e.status === 'new').length,
  };
  next();
});

const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

router.get('/', (req, res) => {
  const bookings = store.bookings.all().sort(byNewest);
  const enquiries = store.enquiries.all().sort(byNewest);
  const quotes = store.quotes.all().sort(byNewest);
  const media = store.media.all();
  res.render('admin/dashboard', {
    pageTitle: 'Dashboard',
    dbStatus: require('../../lib/db').status(),
    counts: {
      pending: bookings.filter((b) => b.status === 'pending').length,
      requests: bookings.filter((b) => ['change_requested', 'cancel_requested'].includes(b.status)).length,
      enquiries: enquiries.filter((e) => e.status === 'new').length,
      quotes: quotes.filter((e) => e.status === 'new').length,
      photos: media.filter((m) => m.kind === 'image').length,
      videos: media.filter((m) => m.kind !== 'image').length,
      activities: data.activities.length,
      breaks: data.allBreaks.length,
    },
    recentBookings: bookings.slice(0, 5), recentEnquiries: enquiries.slice(0, 4),
    changed: content.NAMES.filter((n) => content.isCustomised(n)).map((n) => content.LABELS[n]),
    recentChanges: content.history().slice(0, 6),
  });
});

// ---- inbox
const inbox = (tab) => (req, res) => {
  res.render('admin/inbox', {
    pageTitle: { bookings: 'Bookings', enquiries: 'Enquiries', quotes: 'Quote requests' }[tab], tab,
    bookings: tab === 'bookings' ? store.bookings.all().sort(byNewest) : [],
    enquiries: tab === 'enquiries' ? store.enquiries.all().sort(byNewest) : [],
    quotes: tab === 'quotes' ? store.quotes.all().sort(byNewest) : [],
  });
};
router.get('/bookings', inbox('bookings'));
router.get('/enquiries', inbox('enquiries'));
router.get('/quotes', inbox('quotes'));

router.post('/bookings/:id/status', (req, res) => {
  const status = String(req.body.status || '');
  if (Object.keys(STATUS_LABEL).includes(status)) store.bookings.update(req.params.id, { status, adminNote: clean(req.body.note, 500) });
  flash(req, 'success', 'Booking updated.');
  res.redirect('/admin/bookings');
});
router.post('/enquiries/:id/status', (req, res) => {
  store.enquiries.update(req.params.id, { status: req.body.status === 'done' ? 'done' : 'new' });
  res.redirect('/admin/enquiries');
});
router.post('/quotes/:id/status', (req, res) => {
  store.quotes.update(req.params.id, { status: req.body.status === 'done' ? 'done' : 'new' });
  res.redirect('/admin/quotes');
});

// ---- team
const needSystem = (req, res, next) => (res.locals.isSystemAdmin ? next() : (flash(req, 'error', 'Only the system admin can do that.'), res.redirect('/admin/team')));
router.get('/team', (req, res) => res.render('admin/team', { pageTitle: res.locals.isSystemAdmin ? 'Team' : 'My password', admins: res.locals.isSystemAdmin ? store.admins.all() : [] }));
router.post('/team', limiter(20), needSystem, async (req, res) => {
  const username = clean(req.body.username, 40).toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const pw = String(req.body.password || '');
  if (username.length < 3) flash(req, 'error', 'The username needs at least 3 letters or numbers.');
  else if (pw.length < 10) flash(req, 'error', 'Use a password of at least 10 characters.');
  else if (store.admins.find((a) => a.username === username)) flash(req, 'error', 'That username is taken.');
  else {
    store.admins.insert({ username, name: clean(req.body.name, 80) || username, hash: await bcrypt.hash(pw, 10), role: 'staff' });
    flash(req, 'success', `${username} can now sign in and will see the Guests section only.`);
  }
  res.redirect('/admin/team');
});
router.post('/team/password', limiter(10), async (req, res) => {
  const me = res.locals.adminUser;
  const pw = String(req.body.password || '');
  if (!(await bcrypt.compare(String(req.body.current || ''), me.hash))) flash(req, 'error', 'Your current password is not right.');
  else if (pw.length < 10) flash(req, 'error', 'Use a new password of at least 10 characters.');
  else { store.admins.update(me.id, { hash: await bcrypt.hash(pw, 10) }); flash(req, 'success', 'Password changed.'); }
  res.redirect('/admin/team');
});
router.post('/team/:id/make-admin', needSystem, (req, res) => {
  const target = store.admins.byId(req.params.id);
  if (!target || target.id === res.locals.adminUser.id) flash(req, 'error', 'Choose another team member.');
  else {
    store.admins.update(target.id, { role: 'admin' }); store.admins.update(res.locals.adminUser.id, { role: 'staff' });
    flash(req, 'success', `${target.name} is now the system admin. You now see the Guests section only.`);
  }
  res.redirect('/admin/team');
});
router.post('/team/:id/delete', needSystem, (req, res) => {
  const all = store.admins.all();
  if (req.params.id === res.locals.adminUser.id) flash(req, 'error', 'You cannot remove your own login.');
  else if (all.length < 2) flash(req, 'error', 'There must be at least one team login.');
  else { store.admins.remove(req.params.id); flash(req, 'success', 'Login removed.'); }
  res.redirect('/admin/team');
});

// ---- history and revert
router.get('/history', (req, res) => {
  const only = content.NAMES.includes(req.query.set) ? req.query.set : '';
  res.render('admin/history', {
    pageTitle: 'History & revert', versions: content.history(only || undefined), only,
    sets: content.NAMES.map((n) => ({ name: n, label: content.LABELS[n], custom: content.isCustomised(n) })),
  });
});
router.post('/history/restore', (req, res) => {
  try {
    const name = content.restore(String(req.body.file || ''));
    data.reload();
    flash(req, 'success', `${content.LABELS[name]} restored. The website is updated.`);
  } catch (e) { flash(req, 'error', 'That version could not be restored.'); }
  res.redirect('/admin/history');
});
router.post('/history/reset', (req, res) => {
  const name = String(req.body.name || '');
  if (content.NAMES.includes(name)) {
    content.resetToDefault(name); data.reload();
    flash(req, 'success', `${content.LABELS[name]} is back to the original text. You can still undo this from the list below.`);
  }
  res.redirect('/admin/history');
});

router.use('/media', require('./media'));
router.use('/', require('./content'));

router.use((req, res) => res.status(404).render('admin/notfound', { pageTitle: 'Not found' }));

module.exports = router;

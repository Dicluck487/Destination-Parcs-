'use strict';
/** Content editors: activities, breaks, stay, destinations, home, banners, site, visit info, raw. */
const express = require('express');
const content = require('../../lib/content');
const data = require('../../lib/data');
const { names: ICON_NAMES } = require('../../lib/icons');
const { slugify, durationBucket, ageTags } = require('../../lib/derive');
const f = require('../../lib/forms');
const { flash } = require('../../lib/util');
const { commit, uniqueSlug } = require('./helpers');

const router = express.Router();
const CATEGORIES = data.TYPES.map((t) => t.category);
const ACT_ICONS = ['ball', 'bike', 'bird', 'book', 'brush', 'bug', 'chef', 'compass', 'egg', 'flag', 'flame', 'footprints', 'gift', 'hand', 'home', 'leaf', 'moon', 'racket', 'sun', 'target', 'tree', 'users', 'waves', 'zap'];
const done = (req, res, to, msg) => { flash(req, 'success', msg); res.redirect(to); };

function saved(req, res, name, obj, note, to, msg) {
  const err = commit(req, name, obj, note);
  if (err) { flash(req, 'error', `That change could not be saved because it broke the site (${err.message}). Nothing was changed.`); return res.redirect(req.originalUrl); }
  return done(req, res, to, msg);
}

// =============================================================== ACTIVITIES
router.get('/activities', (req, res) => {
  const set = content.get('activities');
  const q = String(req.query.q || '').toLowerCase().trim();
  const cat = CATEGORIES.includes(req.query.cat) ? req.query.cat : '';
  const items = set.activities.filter((a) => (!q || (a.name + ' ' + a.description).toLowerCase().includes(q)) && (!cat || (a.categories || []).includes(cat)));
  res.render('admin/activities', { pageTitle: 'Activities', items, q, cat, categories: CATEGORIES, total: set.activities.length });
});

const blankActivity = () => ({ slug: '', name: '', categories: [], setting: 'Outdoor', description: '', suitableFor: 'All ages', duration: '1 - 2 hrs', bring: '', safety: '', provided: '', teamValue: '', icon: 'leaf', corporate: false, isNew: true, isUpcoming: false, hidden: false, cover: '', photos: [], videos: [] });

function activityFromBody(b, old) {
  const a = {
    ...old,
    name: f.str(b.name, 100), description: f.text(b.description, 1500),
    categories: f.arr(b.categories).filter((c) => CATEGORIES.includes(c)),
    setting: b.setting === 'Indoor' ? 'Indoor' : 'Outdoor',
    suitableFor: f.str(b.suitableFor, 150), duration: f.str(b.duration, 80),
    bring: f.text(b.bring, 600), safety: f.text(b.safety, 800), provided: f.text(b.provided, 600), teamValue: f.str(b.teamValue, 200),
    icon: ACT_ICONS.includes(b.icon) ? b.icon : 'leaf',
    corporate: f.bool(b.corporate), isNew: f.bool(b.isNew), isUpcoming: f.bool(b.isUpcoming), hidden: f.bool(b.hidden),
    cover: f.image(b.cover), photos: f.images(b.photos), videos: f.videos(b.videos),
  };
  a.needs = a.provided;
  a.durationBucket = durationBucket(a.duration);
  a.ages = ageTags(a.suitableFor);
  if (!a.teamValue) delete a.teamValue;
  return a;
}
const actProblems = (a) => [!a.name && 'Give the activity a name.', !a.description && 'Add a short description.', !a.categories.length && 'Tick at least one type, so visitors can find it.'].filter(Boolean);

router.get('/activities/new', (req, res) => res.render('admin/activity-form', { pageTitle: 'New activity', a: blankActivity(), isNew: true, categories: CATEGORIES, icons: ACT_ICONS, errors: [] }));
router.get('/activities/:slug', (req, res, next) => {
  const a = content.get('activities').activities.find((x) => x.slug === req.params.slug);
  if (!a) return next();
  return res.render('admin/activity-form', { pageTitle: a.name, a: { cover: '', photos: [], videos: [], ...a }, isNew: false, categories: CATEGORIES, icons: ACT_ICONS, errors: [] });
});

router.post('/activities/:slug', (req, res, next) => {
  const set = content.get('activities');
  const creating = req.params.slug === 'new';
  const old = creating ? blankActivity() : set.activities.find((x) => x.slug === req.params.slug);
  if (!old) return next();
  const a = activityFromBody(req.body, old);
  const errors = actProblems(a);
  if (errors.length) return res.status(422).render('admin/activity-form', { pageTitle: creating ? 'New activity' : a.name, a, isNew: creating, categories: CATEGORIES, icons: ACT_ICONS, errors });
  if (creating) {
    a.slug = uniqueSlug(slugify(a.name), set.activities.map((x) => x.slug));
    set.activities.push(a);
  } else {
    set.activities[set.activities.findIndex((x) => x.slug === old.slug)] = a;
  }
  return saved(req, res, 'activities', set, `${creating ? 'Added' : 'Edited'} activity "${a.name}"`, '/admin/activities', creating ? `"${a.name}" is live on the website.` : `"${a.name}" saved.`);
});

router.post('/activities/:slug/toggle', (req, res, next) => {
  const set = content.get('activities');
  const a = set.activities.find((x) => x.slug === req.params.slug);
  if (!a) return next();
  a.hidden = !a.hidden;
  return saved(req, res, 'activities', set, `${a.hidden ? 'Hid' : 'Showed'} activity "${a.name}"`, '/admin/activities', a.hidden ? `"${a.name}" is hidden from the website.` : `"${a.name}" is visible again.`);
});

router.post('/activities/:slug/delete', (req, res, next) => {
  const set = content.get('activities');
  const a = set.activities.find((x) => x.slug === req.params.slug);
  if (!a) return next();
  set.activities = set.activities.filter((x) => x.slug !== a.slug);
  Object.keys(set.groups || {}).forEach((k) => set.groups[k].forEach((g) => { g.items = g.items.filter((s) => s !== a.slug); }));
  return saved(req, res, 'activities', set, `Deleted activity "${a.name}"`, '/admin/activities', `"${a.name}" deleted. You can undo this from History.`);
});

// =============================================================== BREAKS
const BREAK_SETS = [
  { key: 'seasonal', label: 'Seasonal Breaks', kind: 'seasonal' },
  { key: 'other', label: 'Family & Child-Friendly Breaks', kind: 'family' },
  { key: 'signature', label: 'Signature Experiences', kind: 'signature' },
];
const findBreak = (set, slug) => { for (const g of BREAK_SETS) { const b = (set[g.key] || []).find((x) => x.slug === slug); if (b) return { b, group: g.key }; } return null; };

router.get('/breaks', (req, res) => {
  const set = content.get('breaks');
  res.render('admin/breaks', { pageTitle: 'Breaks & packages', groups: BREAK_SETS.map((g) => ({ ...g, items: set[g.key] || [] })) });
});
const blankBreak = () => ({ slug: '', name: '', timing: '', guests: '', feel: '', inclusions: [], hidden: false, cover: '', photos: [], videos: [] });
const breakView = (extra) => ({ BREAK_SETS, activities: content.get('activities').activities, ...extra });

router.get('/breaks/new', (req, res) => res.render('admin/break-form', breakView({ pageTitle: 'New break', b: blankBreak(), group: ['seasonal', 'other', 'signature'].includes(req.query.group) ? req.query.group : 'signature', isNew: true, errors: [] })));
router.get('/breaks/:slug', (req, res, next) => {
  const hit = findBreak(content.get('breaks'), req.params.slug);
  if (!hit) return next();
  return res.render('admin/break-form', breakView({ pageTitle: hit.b.name, b: { cover: '', photos: [], videos: [], ...hit.b }, group: hit.group, isNew: false, errors: [] }));
});

router.post('/breaks/:slug', (req, res, next) => {
  const set = content.get('breaks');
  const creating = req.params.slug === 'new';
  const hit = creating ? { b: blankBreak(), group: 'signature' } : findBreak(set, req.params.slug);
  if (!hit) return next();
  const group = BREAK_SETS.find((g) => g.key === req.body.group) || BREAK_SETS[2];
  const acts = content.get('activities').activities;
  const oldIncl = hit.b.inclusions || [];
  const incl = f.arr(req.body.acts).map(String).filter((s) => acts.some((a) => a.slug === s)).map((s) => {
    const prev = oldIncl.find((i) => i.slug === s);
    return { label: prev ? prev.label : acts.find((a) => a.slug === s).name, slug: s };
  });
  f.lines(req.body.extras, 100).forEach((l) => incl.push({ label: l, slug: null }));
  const b = {
    ...hit.b, name: f.str(req.body.name, 100), timing: f.str(req.body.timing, 100), guests: f.str(req.body.guests, 150),
    feel: f.text(req.body.feel, 400), inclusions: incl, hidden: f.bool(req.body.hidden), kind: group.kind,
    cover: f.image(req.body.cover), photos: f.images(req.body.photos), videos: f.videos(req.body.videos),
  };
  if (!b.feel) delete b.feel;
  const errors = [!b.name && 'Give the break a name.', !b.inclusions.length && 'Choose at least one activity or add an extra inclusion.'].filter(Boolean);
  if (errors.length) return res.status(422).render('admin/break-form', breakView({ pageTitle: b.name || 'New break', b, group: group.key, isNew: creating, errors }));
  if (creating) {
    const all = BREAK_SETS.flatMap((g) => set[g.key] || []).map((x) => x.slug);
    b.slug = uniqueSlug(slugify(b.name), all);
  } else {
    set[hit.group] = set[hit.group].filter((x) => x.slug !== b.slug);
  }
  set[group.key] = set[group.key] || [];
  if (!creating && hit.group === group.key) { // keep position
    const orig = content.get('breaks')[hit.group];
    set[group.key] = orig.map((x) => (x.slug === b.slug ? b : x));
  } else set[group.key].push(b);
  return saved(req, res, 'breaks', set, `${creating ? 'Added' : 'Edited'} break "${b.name}"`, '/admin/breaks', `"${b.name}" saved.`);
});

router.post('/breaks/:slug/toggle', (req, res, next) => {
  const set = content.get('breaks');
  const hit = findBreak(set, req.params.slug);
  if (!hit) return next();
  hit.b.hidden = !hit.b.hidden;
  return saved(req, res, 'breaks', set, `${hit.b.hidden ? 'Hid' : 'Showed'} break "${hit.b.name}"`, '/admin/breaks', hit.b.hidden ? `"${hit.b.name}" is hidden.` : `"${hit.b.name}" is visible again.`);
});
router.post('/breaks/:slug/delete', (req, res, next) => {
  const set = content.get('breaks');
  const hit = findBreak(set, req.params.slug);
  if (!hit) return next();
  set[hit.group] = set[hit.group].filter((x) => x.slug !== hit.b.slug);
  const pages = content.get('pages');
  if ((pages.featuredSignature || []).includes(hit.b.slug)) {
    pages.featuredSignature = pages.featuredSignature.filter((s) => s !== hit.b.slug);
    commit(req, 'pages', pages, `Removed deleted break "${hit.b.name}" from the home page`);
  }
  return saved(req, res, 'breaks', set, `Deleted break "${hit.b.name}"`, '/admin/breaks', `"${hit.b.name}" deleted. You can undo this from History.`);
});

// =============================================================== STAY
const STAY_KINDS = [['room', 'Room or cottage'], ['glamping', 'Glamping'], ['camping', 'Camping']];
router.get('/stay', (req, res) => res.render('admin/stay', { pageTitle: 'Stay & accommodation', items: content.get('stay').options }));
const blankStay = () => ({ slug: '', name: '', kind: 'room', units: 1, sleeps: 2, rate: '', blurb: '', bookable: true, cover: '', photos: [], videos: [] });
router.get('/stay/new', (req, res) => res.render('admin/stay-form', { pageTitle: 'New accommodation', s: blankStay(), isNew: true, kinds: STAY_KINDS, errors: [] }));
router.get('/stay/:slug', (req, res, next) => {
  const s = content.get('stay').options.find((x) => x.slug === req.params.slug);
  if (!s) return next();
  return res.render('admin/stay-form', { pageTitle: s.name, s: { cover: '', photos: [], videos: [], ...s }, isNew: false, kinds: STAY_KINDS, errors: [] });
});
router.post('/stay/:slug', (req, res, next) => {
  const set = content.get('stay');
  const creating = req.params.slug === 'new';
  const old = creating ? blankStay() : set.options.find((x) => x.slug === req.params.slug);
  if (!old) return next();
  const locked = old.slug === 'no-stay';
  const s = {
    ...old, name: f.str(req.body.name, 100), blurb: f.text(req.body.blurb, 600), rate: f.str(req.body.rate, 80),
    cover: f.image(req.body.cover), photos: f.images(req.body.photos), videos: f.videos(req.body.videos),
  };
  if (!locked) {
    s.kind = STAY_KINDS.some((k) => k[0] === req.body.kind) ? req.body.kind : 'room';
    s.units = f.num(req.body.units, 0, 500, 1); s.sleeps = f.num(req.body.sleeps, 1, 60, 2);
    s.bookable = true;
  }
  const errors = [!s.name && 'Give it a name.', !s.blurb && 'Add a short description.'].filter(Boolean);
  if (errors.length) return res.status(422).render('admin/stay-form', { pageTitle: s.name || 'New accommodation', s, isNew: creating, kinds: STAY_KINDS, errors });
  if (creating) { s.slug = uniqueSlug(slugify(s.name), set.options.map((x) => x.slug)); set.options.push(s); } else set.options = set.options.map((x) => (x.slug === s.slug ? s : x));
  return saved(req, res, 'stay', set, `${creating ? 'Added' : 'Edited'} accommodation "${s.name}"`, '/admin/stay', `"${s.name}" saved.`);
});
router.post('/stay/:slug/delete', (req, res, next) => {
  const set = content.get('stay');
  const s = set.options.find((x) => x.slug === req.params.slug);
  if (!s) return next();
  if (s.slug === 'no-stay') { flash(req, 'error', 'The day-visit option is needed by the booking form and cannot be deleted.'); return res.redirect('/admin/stay'); }
  set.options = set.options.filter((x) => x.slug !== s.slug);
  return saved(req, res, 'stay', set, `Deleted accommodation "${s.name}"`, '/admin/stay', `"${s.name}" deleted. Existing bookings keep their record.`);
});

// =============================================================== DESTINATIONS
router.get('/destinations', (req, res) => res.render('admin/destinations', { pageTitle: 'Destinations', items: content.get('destinations').destinations }));
router.get('/destinations/:slug', (req, res, next) => {
  const d = content.get('destinations').destinations.find((x) => x.slug === req.params.slug);
  if (!d) return next();
  return res.render('admin/destination-form', { pageTitle: d.name, d: { cover: '', photos: [], videos: [], ...d } });
});
router.post('/destinations/:slug', (req, res, next) => {
  const set = content.get('destinations');
  const old = set.destinations.find((x) => x.slug === req.params.slug);
  if (!old) return next();
  const d = {
    ...old, name: f.str(req.body.name, 100), area: f.str(req.body.area, 150), short: f.text(req.body.short, 300),
    overview: f.paras(req.body.overview), highlights: f.lines(req.body.highlights, 120),
    cover: f.image(req.body.cover), photos: f.images(req.body.photos), videos: f.videos(req.body.videos),
  };
  if (!d.name) { flash(req, 'error', 'The destination needs a name.'); return res.redirect(req.originalUrl); }
  set.destinations = set.destinations.map((x) => (x.slug === d.slug ? d : x));
  return saved(req, res, 'destinations', set, `Edited destination "${d.name}"`, '/admin/destinations', `${d.name} saved.`);
});

// =============================================================== HOME
router.get('/home', (req, res) => {
  const p = content.get('pages');
  res.render('admin/home', {
    pageTitle: 'Home page', p, icons: ICON_NAMES.filter((n) => !['facebook', 'instagram', 'youtube', 'twitter-x', 'tiktok', 'whatsapp'].includes(n)),
    signature: (content.get('breaks').signature || []).filter((b) => !b.hidden),
  });
});
router.post('/home', (req, res) => {
  const old = content.get('pages');
  const b = req.body;
  const hero = f.arr(b.hero).map((h) => ({
    key: f.str(h && h.key, 30), label: f.str(h && h.label, 40), headline: f.str(h && h.headline, 120), sub: f.str(h && h.sub, 200), alt: f.str(h && h.alt, 200),
    image: f.image(h && h.image), video: f.videoFile(h && h.video),
  })).filter((h) => h.headline || h.image || h.video || h.key);
  // pictures added in one go become new slides (they use the first slide's words until edited)
  const have = new Set(hero.map((h) => h.image).filter(Boolean));
  f.images(b.heroPics).filter((u) => !have.has(u)).forEach((u) => { hero.push({ key: '', label: '', headline: '', sub: '', alt: '', image: u, video: '' }); have.add(u); });
  if (!hero.length) { flash(req, 'error', 'The banner must keep at least one picture. Nothing was removed.'); return res.redirect('/admin/home'); }
  hero.forEach((h, i) => { if (!h.label) h.label = `Slide ${i + 1}`; if (!h.image) delete h.image; if (!h.video) delete h.video; if (!h.key) delete h.key; });
  const sigSlugs = (content.get('breaks').signature || []).map((x) => x.slug);
  const p = {
    ...old, hero,
    experiences: f.arr(b.experiences).map((e) => ({ key: f.str(e && e.key, 30) || slugify(e && e.name), name: f.str(e && e.name, 40), blurb: f.str(e && e.blurb, 140), icon: ICON_NAMES.includes(e && e.icon) ? e.icon : 'leaf', href: f.href(e && e.href) || '/things-to-do' })).filter((e) => e.name),
    featuredSignature: f.arr(b.featured).map(String).filter((s) => sigSlugs.includes(s)).slice(0, 6),
    seasonalBanner: { show: f.bool(b.seasonalShow), badge: f.str(b.seasonalBadge, 40), title: f.str(b.seasonalTitle, 100), text: f.text(b.seasonalText, 300), href: f.href(b.seasonalHref) || '/breaks/seasonal' },
    highlights: f.arr(b.highlights).map((h) => ({ title: f.str(h && h.title, 60), text: f.text(h && h.text, 220) })).filter((h) => h.title),
    gallery: f.mixed(b.gallery),
    announcements: { show: f.bool(b.noticeShow), items: String(b.noticeItems || '').split(/\r?\n/).map((x) => f.str(x, 140)).filter(Boolean).slice(0, 10) },
  };
  return saved(req, res, 'pages', p, 'Edited the home page', '/admin/home', 'Home page saved. It is live now.');
});


// =============================================================== FULL GALLERY PAGE (albums of photos and videos)
router.get('/gallery', (req, res) => {
  res.render('admin/gallery', { pageTitle: 'Gallery', albums: content.get('pages').albums || [] });
});
router.post('/gallery', (req, res) => {
  const old = content.get('pages');
  const albums = f.arr(req.body.albums).slice(0, 8).map((a, i) => ({
    name: f.str(a && a.name, 40) || `Album ${i + 1}`,
    items: f.mixed(a && a.items, 60),
  })).filter((a) => a.items.length);
  return saved(req, res, 'pages', { ...old, albums }, 'Edited the gallery page', '/admin/gallery', 'Gallery saved. It is live now.');
});

// =============================================================== CARD PICTURES (one screen for every card photo)
function pictureGroups() {
  const acts = content.get('activities').activities;
  const brk = content.get('breaks');
  const stay = content.get('stay').options;
  const dest = content.get('destinations').destinations;
  const rows = (arr, key, nameOf) => arr.map((x) => ({ id: `${key}:${x.slug}`, name: nameOf ? nameOf(x) : x.name, value: x.cover || (x.photos && x.photos[0]) || '' }));
  return [
    { key: 'activities', label: 'Activities', note: 'The card on Things To Do, Home and the related lists.', rows: rows(acts, 'act') },
    ...BREAK_SETS.map((g) => ({ key: g.key, label: g.label, note: 'The card on Breaks & Packages and the Home page.', rows: rows(brk[g.key] || [], `brk-${g.key}`) })),
    { key: 'stay', label: 'Stay', note: 'The cards on the Accommodation and Camping pages.', rows: rows(stay.filter((x) => x.slug !== 'no-stay'), 'stay') },
    { key: 'destinations', label: 'Destinations', note: 'The cards on the Destinations page and each destination banner.', rows: rows(dest, 'dest') },
  ];
}
router.get('/pictures', (req, res) => res.render('admin/pictures', { pageTitle: 'Card pictures', groups: pictureGroups() }));
router.post('/pictures', (req, res) => {
  const pics = req.body.pic || {};
  const want = (id) => (Object.prototype.hasOwnProperty.call(pics, id) ? f.image(pics[id]) : null);
  const changed = []; let n = 0;
  const apply = (name, list) => {
    let touched = false;
    list.forEach((x) => {
      const id = x.__id; const v = want(id);
      if (v === null) return;
      const cur = x.cover || (x.photos && x.photos[0]) || '';
      if (v !== cur) {
        if (v) x.cover = v;
        else { if (!x.cover && x.photos && x.photos.length) x.photos = x.photos.slice(1); delete x.cover; }
        touched = true; n += 1;
      }
    });
    if (touched) changed.push(name);
  };
  const tag = (arr, key) => arr.forEach((x) => { Object.defineProperty(x, '__id', { value: `${key}:${x.slug}`, enumerable: false, configurable: true }); });
  const aSet = content.get('activities'); tag(aSet.activities, 'act'); apply('activities', aSet.activities);
  const bSet = content.get('breaks'); BREAK_SETS.forEach((g) => { tag(bSet[g.key] || [], `brk-${g.key}`); apply('breaks', bSet[g.key] || []); });
  const sSet = content.get('stay'); tag(sSet.options, 'stay'); apply('stay', sSet.options);
  const dSet = content.get('destinations'); tag(dSet.destinations, 'dest'); apply('destinations', dSet.destinations);
  const sets = { activities: aSet, breaks: bSet, stay: sSet, destinations: dSet };
  for (const name of Array.from(new Set(changed))) {
    const err = commit(req, name, sets[name], 'Changed card pictures');
    if (err) { flash(req, 'error', `A picture change could not be saved (${err.message}).`); return res.redirect('/admin/pictures'); }
  }
  return done(req, res, '/admin/pictures', n ? `Saved. ${n} card picture${n === 1 ? '' : 's'} changed and live now.` : 'No changes to save.');
});

// =============================================================== BANNERS
const BANNERS = [['plan', 'Plan Your Visit'], ['experience', 'The D.P Experience'], ['stay', 'Stay'], ['breaks', 'Breaks & Packages'], ['corporate', 'Corporate & Events'], ['venues', 'Conferences & Venues (top)'], ['venues-2', 'Conferences & Venues (second image)'], ['weddings', 'Weddings & Celebrations'], ['rendezvous', 'Rendezvous Spaces']];
router.get('/banners', (req, res) => {
  const p = content.get('pages');
  res.render('admin/banners', { pageTitle: 'Page banners', banners: BANNERS, types: data.TYPES, p });
});
router.post('/banners', (req, res) => {
  const old = content.get('pages');
  const banners = {}; const typeCovers = {};
  BANNERS.forEach(([k]) => { const v = f.image((req.body.banners || {})[k]); if (v) banners[k] = v; });
  data.TYPES.forEach((t) => { const v = f.image((req.body.types || {})[t.slug]); if (v) typeCovers[t.slug] = v; });
  return saved(req, res, 'pages', { ...old, banners, typeCovers }, 'Edited page banners', '/admin/banners', 'Banners saved.');
});

// =============================================================== SITE SETTINGS
router.get('/site', (req, res) => res.render('admin/site', { pageTitle: 'Site settings', s: content.get('site') }));
router.post('/site', (req, res) => {
  const old = content.get('site'); const b = req.body; const g = (k) => b[k] || {};
  const coord = (v, lim) => { const n = parseFloat(v); return Number.isFinite(n) && Math.abs(n) <= lim ? n : null; };
  const s = {
    ...old, name: f.str(b.name, 60) || old.name, tagline: f.str(b.tagline, 120), heroLine: f.str(b.heroLine, 160), description: f.text(b.description, 300),
    contact: { phone: f.str(g('contact').phone, 40), whatsapp: f.str(g('contact').whatsapp, 40), email: f.str(g('contact').email, 120), address: f.str(g('contact').address, 200), hours: f.str(g('contact').hours, 200) },
    social: Object.fromEntries(['facebook', 'instagram', 'x', 'youtube', 'tiktok'].map((k) => [k, f.url(g('social')[k])])),
    mapEmbed: { lat: coord(g('mapEmbed').lat, 90), lng: coord(g('mapEmbed').lng, 180), zoom: f.num(g('mapEmbed').zoom, 1, 19, 15) },
    mapSearchQuery: f.str(b.mapSearchQuery, 200),
    otaLinks: Object.fromEntries(['bookingCom', 'agoda', 'airbnb'].map((k) => [k, f.url(g('otaLinks')[k])])),
    depositNote: f.text(b.depositNote, 400),
  };
  return saved(req, res, 'site', s, 'Edited site settings', '/admin/site', 'Site settings saved.');
});

// =============================================================== VISIT INFO
router.get('/visit', (req, res) => res.render('admin/visit', { pageTitle: 'Visit info & FAQs', p: content.get('plan') }));
router.post('/visit', (req, res) => {
  const old = content.get('plan'); const b = req.body;
  const pairs = (x, a, c, ma, mc) => f.arr(x).map((r) => ({ [a]: f.str(r && r[a], ma), [c]: f.text(r && r[c], mc) })).filter((r) => r[a]);
  const p = {
    ...old,
    firstTime: {
      ...old.firstTime,
      getThere: f.lines(b.getThere, 300), bring: f.lines(b.bring, 200), expect: f.lines(b.expect, 300), safety: f.lines(b.safety, 300),
      hours: f.text(b.hours, 400), faqs: pairs(b.faqs, 'q', 'a', 200, 1200),
    },
    experience: { ...old.experience, story: f.paras(b.story), pillars: pairs(b.pillars, 'title', 'text', 60, 400) },
    accessibility: { ...old.accessibility, intro: f.text(b.accIntro, 600), sections: pairs(b.accSections, 'title', 'text', 80, 800) },
  };
  return saved(req, res, 'plan', p, 'Edited visit info and FAQs', '/admin/visit', 'Visit info saved.');
});

// =============================================================== RAW (advanced)
const typeOf = (v) => (Array.isArray(v) ? 'array' : typeof v);
router.get('/advanced/:name', (req, res, next) => {
  if (!content.NAMES.includes(req.params.name)) return next();
  return res.render('admin/raw', { pageTitle: `Advanced: ${content.LABELS[req.params.name]}`, name: req.params.name, label: content.LABELS[req.params.name], json: JSON.stringify(content.get(req.params.name), null, 2), error: '' });
});
router.post('/advanced/:name', (req, res, next) => {
  const name = req.params.name;
  if (!content.NAMES.includes(name)) return next();
  const text = String(req.body.json || '');
  const fail = (msg) => res.status(422).render('admin/raw', { pageTitle: `Advanced: ${content.LABELS[name]}`, name, label: content.LABELS[name], json: text, error: msg });
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return fail(`This is not valid JSON: ${e.message}`); }
  const seed = content.seed(name);
  const bad = Object.keys(seed).filter((k) => typeOf(obj[k]) !== typeOf(seed[k]));
  if (typeOf(obj) !== 'object' || bad.length) return fail(`These top-level sections are missing or the wrong kind: ${bad.join(', ') || 'whole document'}.`);
  const err = commit(req, name, obj, 'Edited in the advanced editor');
  if (err) return fail(`The site could not use this content, so nothing was changed. (${err.message})`);
  return done(req, res, '/admin', `${content.LABELS[name]} saved.`);
});

module.exports = router;

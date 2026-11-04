'use strict';
const express = require('express');
const d = require('../lib/data');
const media = require('../lib/media');

const router = express.Router();
const base = { activeNav: 'things-to-do' };

router.get('/', (req, res) => {
  const list = d.filterActivities(req.query);
  const active = ['type', 'age', 'duration', 'setting', 'corporate', 'q'].filter((k) => req.query[k]);
  res.render('pages/browse', {
    ...base, pageTitle: 'Browse All Activities',
    metaDescription: 'Filter every Destination Parcs activity by type, age group, duration, setting and corporate suitability.',
    list, total: d.activities.length, activeFilters: active.length,
    selected: {
      type: String(req.query.type || ''), age: String(req.query.age || ''), duration: String(req.query.duration || ''),
      setting: String(req.query.setting || ''), corporate: req.query.corporate === '1', q: String(req.query.q || '').slice(0, 60),
    },
  });
});

router.get('/food-and-drinks', (req, res) => {
  const food = ['chef-academy', 'fire-building-and-campfire', 'farm-visits', 'pool', 'jim-jam-pyjama-party', 'easter-egg-hunt']
    .map((s) => d.actBySlug[s]).filter(Boolean);
  res.render('pages/food', { ...base, pageTitle: 'Food & Drinks', food });
});

router.get('/new', (req, res) => {
  res.render('pages/activity-list', {
    ...base, pageTitle: 'New Activities', eyebrow: 'Just added',
    lead: 'Fresh experiences recently added to the Destination Parcs programme.', list: d.newActivities, badge: 'New',
  });
});

router.get('/upcoming', (req, res) => {
  res.render('pages/upcoming', {
    ...base, pageTitle: 'Upcoming Activities', list: d.upcomingActivities,
    extras: [{ name: 'New Year Breaks', href: '/breaks/new-year-breaks', note: 'Around 31 December to 2 January' }],
  });
});

router.get('/type/:type', (req, res, next) => {
  const type = d.typeBySlug[req.params.type];
  if (!type) return next();
  const groups = d.typeGroups(type.slug);
  const count = d.typeActivities(type.slug).length;
  res.render('pages/type', {
    ...base, pageTitle: `${type.name} Activities`, type, groups, count,
    metaDescription: `${count} ${type.name.toLowerCase()} activities at Destination Parcs. ${type.blurb}`,
    others: d.TYPES.filter((t) => t.slug !== type.slug),
    cover: media.photo('types', type.slug),
  });
});

router.get('/:slug', (req, res, next) => {
  const a = d.actBySlug[req.params.slug];
  if (!a) return next();
  const gallery = media.gallery('activities', a.slug, 5);
  res.render('pages/activity', {
    ...base, pageTitle: a.name, activity: a, gallery,
    metaDescription: a.description,
    ogImage: gallery[0] ? `${res.locals.baseUrl}${gallery[0]}` : res.locals.ogImage,
    related: a.related.map((s) => d.actBySlug[s]).filter(Boolean),
    inTrip: res.locals.trip.includes(a.slug),
    inBreaks: d.allBreaks.filter((b) => b.inclusions.some((i) => i.slug === a.slug)),
  });
});

module.exports = router;

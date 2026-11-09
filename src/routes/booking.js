'use strict';
const express = require('express');
const d = require('../lib/data');
const store = require('../lib/store');
const av = require('../lib/availability');
const { flash, clean, requireUser, limiter, bookingRef, STATUS_LABEL } = require('../lib/util');

const router = express.Router();
const base = { activeNav: '' };

// Sign In -> Choose Location -> Pick Break and Duration -> Select Stay and Activities -> Submit
router.get('/', requireUser, (req, res) => {
  const bookableLocations = d.destinations.filter((x) => x.bookable);
  const q = req.query;
  const brk = d.breakBySlug[String(q.break || '')] || null;
  const preActs = new Set(req.session.trip);
  if (brk) brk.inclusions.forEach((i) => i.slug && preActs.add(i.slug));
  const dur = d.DURATIONS.find((x) => x.slug === q.duration) || null;
  const saved = res.locals.user.saved || { adults: 2, children: 0 };
  const guests = parseInt(q.guests, 10);
  const form = req.session.form || {
    location: bookableLocations.find((l) => l.slug === q.location) ? q.location : bookableLocations[0].slug,
    breakSlug: brk ? brk.slug : '',
    duration: dur ? dur.slug : 'day-visit',
    nights: dur ? dur.nights[0] : 0,
    checkIn: av.validDate(q.checkIn) ? q.checkIn : '',
    adults: guests > 0 ? Math.min(guests, 60) : saved.adults,
    children: saved.children,
    stay: 'no-stay', units: 1,
    activities: [...preActs],
    notes: saved.notes || '',
  };
  req.session.form = null;
  const types = d.TYPES.map((t) => ({ ...t, items: d.typeActivities(t.slug) }));
  res.render('pages/book', {
    ...base, pageTitle: 'Book your break', bodyClass: 'is-booking', form,
    locations: bookableLocations, durations: d.DURATIONS, stayOptions: d.stayOptions, types,
    breakGroups: [
      { label: 'Seasonal Breaks', items: d.breaks.seasonal },
      { label: 'Family & Child-Friendly Breaks', items: d.breaks.other },
      { label: 'Signature Experiences', items: d.breaks.signature },
    ],
    breakMap: Object.fromEntries(d.allBreaks.map((b) => [b.slug, b.inclusions.filter((i) => i.slug).map((i) => i.slug)])),
    today: av.today(), maxDate: av.addDays(av.today(), 540),
    extraScripts: ['/js/booking.js'],
  });
});

router.post('/', requireUser, limiter(20), (req, res) => {
  const bookableLocations = d.destinations.filter((x) => x.bookable);
  const u = res.locals.user;
  const b = req.body;
  const dur = d.DURATIONS.find((x) => x.slug === b.duration);
  const loc = bookableLocations.find((l) => l.slug === b.location);
  const brk = d.breakBySlug[String(b.breakSlug || '')] || null;
  const stayOpt = d.stayBySlug[String(b.stay || 'no-stay')];
  const acts = [].concat(b.activities || []).map(String).filter((s) => d.actBySlug[s]);
  const uniqueActs = Array.from(new Set(acts)).slice(0, 25);
  const adults = Math.max(1, Math.min(200, parseInt(b.adults, 10) || 0));
  const children = Math.max(0, Math.min(200, parseInt(b.children, 10) || 0));
  const checkIn = clean(b.checkIn, 10);
  let nights = dur ? parseInt(b.nights, 10) : 0;
  if (dur && !dur.nights.includes(nights)) nights = dur.nights[0];
  let units = Math.max(1, Math.min(50, parseInt(b.units, 10) || 1));

  const form = {
    location: b.location, breakSlug: brk ? brk.slug : '', duration: b.duration, nights, checkIn, adults, children,
    stay: b.stay, units, activities: uniqueActs, notes: clean(b.notes, 1000),
  };
  const fail = (m) => { req.session.form = form; flash(req, 'error', m); return res.redirect('/book'); };

  if (!loc) return fail('Please choose a location.');
  if (!dur) return fail('Please choose a break duration.');
  if (!av.validDate(checkIn) || checkIn < av.today()) return fail('Please pick an arrival date that is today or later.');
  if (!stayOpt) return fail('Please choose where you would like to stay.');
  if (nights === 0 && stayOpt.units > 0) {
    form.stay = 'no-stay';
    return fail('A day visit has no overnight stay. Choose a longer break, or pick "Day visit" for accommodation.');
  }
  if (nights > 0 && !(stayOpt.units > 0)) return fail('Please choose accommodation for your overnight stay.');
  if (nights > 0) {
    const need = Math.ceil((adults + children) / Math.max(stayOpt.sleeps, 1));
    if (units < need) return fail(`For ${adults + children} guests you need at least ${need} ${stayOpt.name} (each sleeps ${stayOpt.sleeps}).`);
    units = Math.max(units, need);
    if (!av.fits(stayOpt.slug, checkIn, nights, units)) return fail(`${stayOpt.name} is not available for all of those nights. Try different dates or another accommodation type.`);
  }

  let ref = bookingRef();
  while (store.bookings.find((x) => x.ref === ref)) ref = bookingRef();
  const rec = store.bookings.insert({
    ref, userId: u.id, status: 'pending',
    location: { slug: loc.slug, name: loc.name },
    break: brk ? { slug: brk.slug, name: brk.name } : null,
    duration: { slug: dur.slug, name: dur.name },
    checkIn, nights, checkOut: av.addDays(checkIn, nights),
    adults, children,
    stay: nights > 0 ? { slug: stayOpt.slug, name: stayOpt.name, units } : { slug: 'no-stay', name: 'Day visit', units: 0 },
    activities: uniqueActs.map((s) => ({ slug: s, name: d.actBySlug[s].name })),
    notes: form.notes,
    contact: { name: u.name, email: u.email || '', phone: u.phone || '' },
    requests: [],
  });
  req.session.trip = [];
  return res.redirect(`/book/confirmation/${rec.ref}`);
});

router.get('/confirmation/:ref', requireUser, (req, res, next) => {
  const bk = store.bookings.find((x) => x.ref === req.params.ref && x.userId === res.locals.user.id);
  if (!bk) return next();
  res.render('pages/confirmation', { ...base, pageTitle: 'Request received', b: bk, STATUS_LABEL });
});

module.exports = router;

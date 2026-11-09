'use strict';
const express = require('express');
const d = require('../lib/data');
const store = require('../lib/store');
const media = require('../lib/media');
const { flash, clean, isEmail, normPhone, isPhone, limiter } = require('../lib/util');

const router = express.Router();

router.get('/', (req, res) => {
  const featured = d.pages.featuredSignature.map((s) => d.breakBySlug[s]).filter(Boolean);
  res.render('pages/home', {
    pageTitle: 'Extraordinary places. Lasting memories.',
    bodyClass: 'is-home',
    featured,
    newActs: d.newActivities,
    upcoming: d.upcomingActivities,
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'TouristAttraction', name: d.site.name,
      description: d.site.description, slogan: d.site.tagline,
      address: { '@type': 'PostalAddress', streetAddress: 'Katuulo, Bujuuko-Mityana Road', addressCountry: 'UG' },
    },
  });
});

router.get('/gallery', (req, res) => {
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let albums = (d.pages.albums || []).filter((a) => a && a.items && a.items.length).map((a) => ({ name: a.name, slug: slug(a.name), items: a.items }));
  if (!albums.length) {
    // nothing added yet: show the home page gallery, or the built-in pictures
    const home = (d.pages.gallery || []).filter((g) => g && g.src);
    const items = home.length ? home : media.list('gallery').map((src) => ({ type: 'image', src, caption: '' }));
    albums = items.length ? [{ name: 'All photos', slug: 'all', items }] : [];
  }
  res.render('pages/gallery', {
    pageTitle: 'Photo and video gallery', activeNav: 'plan', albums,
    metaDescription: 'Photos and videos from Destination Parcs, The Farm, Katuulo.',
  });
});

router.get('/destinations', (req, res) => {
  res.render('pages/destinations', {
    pageTitle: 'Destinations', activeNav: 'destinations',
    metaDescription: 'Explore Destination Parcs locations, starting with The Farm in Katuulo.',
  });
});

router.get('/destinations/rendezvous-spaces', (req, res) => {
  res.render('pages/rendezvous', { pageTitle: 'Rendezvous Spaces', activeNav: 'destinations' });
});

router.get('/destinations/:slug', (req, res, next) => {
  const dest = d.destinations.find((x) => x.slug === req.params.slug);
  if (!dest) return next();
  const topActs = ['aerial-tree-trekking', 'laser-combat', 'bird-watching', 'fire-building-and-campfire', 'farm-visits', 'adventure-golf']
    .map((s) => d.actBySlug[s]).filter(Boolean);
  res.render('pages/destination', {
    pageTitle: dest.name, activeNav: 'destinations', dest, topActs,
    galleryItems: media.items({ ...dest, cover: null, photos: dest.photos || [], slug: dest.slug }, 'destinations', 6),
    metaDescription: dest.short,
  });
});

// Enquiry form (footer, contact page, rendezvous spaces)
router.post('/enquiry', limiter(10), (req, res) => {
  const name = clean(req.body.name, 100);
  let email = clean(req.body.email, 150).toLowerCase();
  let phone = normPhone(req.body.phone);
  if (email && !isEmail(email) && isPhone(normPhone(email))) { phone = phone || normPhone(email); email = ''; } // footer field accepts either
  const message = clean(req.body.message, 2000);
  const topic = clean(req.body.topic, 80) || 'General enquiry';
  const back = /^\/(?!\/)/.test(req.body.back || '') ? req.body.back : '/plan-your-visit/contact';
  if (req.body.website) return res.redirect(back); // honeypot
  if (!name || !message || (!email && !phone) || (email && !isEmail(email)) || (phone && !isPhone(phone))) {
    flash(req, 'error', 'Please give your name, a message, and a valid email or phone number.');
    return res.redirect(back);
  }
  store.enquiries.insert({ name, email, phone, message, topic, status: 'new' });
  flash(req, 'success', 'Thank you. Your message has reached our team and we will reply soon.');
  return res.redirect(back);
});

module.exports = router;

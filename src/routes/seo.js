'use strict';
const express = require('express');
const d = require('../lib/data');

const router = express.Router();

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /book\nDisallow: /api\nSitemap: ${res.locals.baseUrl}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/destinations', '/destinations/rendezvous-spaces', '/things-to-do', '/things-to-do/food-and-drinks', '/things-to-do/new', '/things-to-do/upcoming',
    '/stay', '/stay/rooms', '/stay/availability', '/stay/camping-and-glamping', '/breaks', '/breaks/seasonal', '/breaks/family', '/breaks/signature', '/breaks/durations',
    '/corporate', '/corporate/meetings-and-retreats', '/corporate/team-building', '/corporate/nature-and-csr', '/corporate/weddings-and-celebrations',
    '/corporate/conferences-and-venues', '/corporate/checklist', '/corporate/quote',
    '/plan-your-visit', '/plan-your-visit/first-time', '/plan-your-visit/experience', '/plan-your-visit/accessibility', '/plan-your-visit/contact', '/gallery',
    ...d.destinations.map((x) => `/destinations/${x.slug}`),
    ...d.TYPES.map((t) => `/things-to-do/type/${t.slug}`),
    ...d.activities.map((a) => `/things-to-do/${a.slug}`),
    ...d.allBreaks.map((b) => `/breaks/${b.slug}`)];
  const body = urls.map((u) => `  <url><loc>${res.locals.baseUrl}${u}</loc></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
});

module.exports = router;

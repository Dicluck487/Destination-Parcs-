'use strict';
const express = require('express');
const PDFDocument = require('pdfkit');
const d = require('../lib/data');
const store = require('../lib/store');
const { flash, clean, isEmail, normPhone, isPhone, limiter } = require('../lib/util');

const router = express.Router();
const base = { activeNav: 'corporate' };

const EVENT_TYPES = [
  'Board retreat', 'Corporate meeting or training', 'Corporate retreat', 'Concentrated task session',
  'Team building', 'Nature or CSR outing', 'Wedding celebration', 'Traditional wedding',
  'Anniversary party', 'Conference or venue hire', 'Other',
];

router.get('/', (req, res) => {
  res.render('pages/corporate', { ...base, pageTitle: 'Corporate & Events', corp: d.corporate });
});
router.get('/meetings-and-retreats', (req, res) => {
  res.render('pages/corp-meetings', { ...base, pageTitle: 'Meetings & Retreats', items: d.corporate.meetings });
});
router.get('/team-building', (req, res) => {
  res.render('pages/corp-team', { ...base, pageTitle: 'Team Building & Challenges', items: d.corpTeam });
});
router.get('/nature-and-csr', (req, res) => {
  res.render('pages/corp-nature', { ...base, pageTitle: 'Nature & CSR Outings', items: d.corpNature });
});
router.get('/weddings-and-celebrations', (req, res) => {
  res.render('pages/corp-weddings', { ...base, pageTitle: 'Weddings & Celebrations', items: d.corporate.social });
});
router.get('/conferences-and-venues', (req, res) => {
  res.render('pages/corp-venues', { ...base, pageTitle: 'Conferences & Venues' });
});
router.get('/checklist', (req, res) => {
  res.render('pages/corp-checklist', { ...base, pageTitle: 'Corporate Planning Checklist', items: d.corporate.checklist });
});

router.get('/checklist.pdf', (req, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Destination Parcs Corporate Planning Checklist' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Destination-Parcs-Corporate-Planning-Checklist.pdf"');
  doc.pipe(res);
  const forest = '#0B3D2A'; const gold = '#C9A24B'; const ink = '#12201A';
  doc.rect(0, 0, doc.page.width, 110).fill(forest);
  doc.fillColor('#FBF9F3').font('Times-Bold').fontSize(26).text('Destination Parcs', 56, 38);
  doc.font('Helvetica').fontSize(9).fillColor(gold).text('EXTRAORDINARY PLACES. LASTING MEMORIES.', 56, 72, { characterSpacing: 2 });
  doc.fillColor(forest).font('Times-Bold').fontSize(22).text('Corporate Planning Checklist', 56, 140);
  doc.moveTo(56, 172).lineTo(160, 172).lineWidth(2).strokeColor(gold).stroke();
  doc.font('Helvetica').fontSize(11).fillColor(ink)
    .text('Use this list when you plan a meeting, retreat, team-building day or event at The Farm. Tick each item, then send it to our team with your quote request.', 56, 186, { width: 480, lineGap: 3 });
  let y = 250;
  d.corporate.checklist.forEach((item) => {
    doc.roundedRect(56, y, 14, 14, 3).lineWidth(1.2).strokeColor(forest).stroke();
    doc.font('Helvetica').fontSize(13).fillColor(ink).text(item, 84, y - 1, { width: 450 });
    doc.moveTo(84, y + 24).lineTo(540, y + 24).lineWidth(0.5).strokeColor('#D9D3C0').stroke();
    y += 38;
  });
  y += 14;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(forest).text('Your notes', 56, y);
  for (let i = 0; i < 5; i++) doc.moveTo(56, y + 30 + i * 26).lineTo(540, y + 30 + i * 26).lineWidth(0.5).strokeColor('#D9D3C0').stroke();
  const c = d.site.contact;
  doc.font('Helvetica').fontSize(9).fillColor('#5b6b62')
    .text(`The Farm, Katuulo, along Bujuuko-Mityana Road${c.phone ? '  |  ' + c.phone : ''}${c.email ? '  |  ' + c.email : ''}`, 56, 780, { width: 480, align: 'center' });
  doc.end();
});

router.get('/quote', (req, res) => {
  res.render('pages/corp-quote', { ...base, pageTitle: 'Request a Quote', eventTypes: EVENT_TYPES, form: req.session.form || {} });
  req.session.form = null;
});

router.post('/quote', limiter(8), (req, res) => {
  const f = {
    name: clean(req.body.name, 100), organisation: clean(req.body.organisation, 150),
    email: clean(req.body.email, 150).toLowerCase(), phone: normPhone(req.body.phone),
    eventType: EVENT_TYPES.includes(req.body.eventType) ? req.body.eventType : 'Other',
    groupSize: Math.max(0, Math.min(5000, parseInt(req.body.groupSize, 10) || 0)),
    dates: clean(req.body.dates, 150), nights: clean(req.body.nights, 20),
    needs: [].concat(req.body.needs || []).map((n) => clean(n, 60)).filter(Boolean).slice(0, 12),
    message: clean(req.body.message, 2000),
  };
  if (req.body.website) return res.redirect('/corporate/quote');
  const problems = [];
  if (!f.name) problems.push('your name');
  if (!f.email && !f.phone) problems.push('an email or phone number');
  if (f.email && !isEmail(f.email)) problems.push('a valid email');
  if (f.phone && !isPhone(f.phone)) problems.push('a valid phone number');
  if (!f.groupSize) problems.push('your group size');
  if (problems.length) {
    req.session.form = f;
    flash(req, 'error', `Please add ${problems.join(', ')}.`);
    return res.redirect('/corporate/quote');
  }
  store.quotes.insert({ ...f, status: 'new' });
  flash(req, 'success', 'Thank you. Your quote request has been received and our events team will get back to you.');
  return res.redirect('/corporate/quote');
});

module.exports = router;

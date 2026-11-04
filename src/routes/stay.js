'use strict';
const express = require('express');
const d = require('../lib/data');

const router = express.Router();
const base = { activeNav: 'plan' };

router.get('/', (req, res) => res.render('pages/plan', { ...base, pageTitle: 'Plan Your Visit' }));
router.get('/first-time', (req, res) => res.render('pages/plan-first', { ...base, pageTitle: 'First Time at Destination Parcs', p: d.plan.firstTime }));
router.get('/experience', (req, res) => res.render('pages/plan-experience', { ...base, pageTitle: 'The D.P Experience', p: d.plan.experience }));
router.get('/accessibility', (req, res) => res.render('pages/plan-access', { ...base, pageTitle: 'Accessibility', p: d.plan.accessibility }));
router.get('/contact', (req, res) => res.render('pages/plan-contact', { ...base, pageTitle: 'Contact & Directions' }));

module.exports = router;

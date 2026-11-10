'use strict';
// Every public page that has a banner at the top, so the admin can change its heading, intro and picture.
// key = the page address. banner = the older picture setting that the same page already used.
const GROUPS = [
  ['Plan Your Visit', [
    ['/plan-your-visit', 'Plan Your Visit', 'Before you come', 'plan'],
    ['/plan-your-visit/first-time', 'First Time at Destination Parcs', 'Plan Your Visit'],
    ['/plan-your-visit/experience', 'The D.P Experience', 'Plan Your Visit', 'experience'],
    ['/plan-your-visit/accessibility', 'Accessibility', 'Plan Your Visit'],
    ['/plan-your-visit/contact', 'Contact & Directions', 'Plan Your Visit'],
    ['/gallery', 'Photo and video gallery', 'Plan Your Visit'],
  ]],
  ['Destinations', [
    ['/destinations', 'Destinations', 'Where we are'],
    ['/destinations/rendezvous-spaces', 'Rendezvous Spaces', 'Hire a space', 'rendezvous'],
  ]],
  ['Things To Do', [
    ['/things-to-do', 'Browse All Activities', 'Things To Do'],
    ['/things-to-do/food-and-drinks', 'Food & Drinks', 'Things To Do'],
    ['/things-to-do/new', 'New Activities', 'Just added'],
    ['/things-to-do/upcoming', 'Upcoming Activities', 'Coming next'],
  ]],
  ['Stay', [
    ['/stay', 'Accommodation', 'Stay at The Farm', 'stay'],
    ['/stay/rooms', 'Room Types & Rates', 'Stay'],
    ['/stay/camping-and-glamping', 'Camping or Glamping', 'Stay'],
    ['/stay/availability', 'Availability Calendar', 'Stay'],
  ]],
  ['Breaks & Packages', [
    ['/breaks', 'Breaks & Packages', 'Plan a break', 'breaks'],
    ['/breaks/seasonal', 'Seasonal Breaks', 'Seasonal'],
    ['/breaks/family', 'Family & Child-Friendly Breaks', 'Family'],
    ['/breaks/signature', 'Signature Experiences', 'Signature'],
    ['/breaks/durations', 'Break Durations', 'Breaks & Packages'],
  ]],
  ['Corporate & Events', [
    ['/corporate', 'Corporate & Events', 'Work, together', 'corporate'],
    ['/corporate/meetings-and-retreats', 'Meetings & Retreats', 'Corporate & Events'],
    ['/corporate/team-building', 'Team Building & Challenges', 'Corporate & Events'],
    ['/corporate/nature-and-csr', 'Nature & CSR Outings', 'Corporate & Events'],
    ['/corporate/weddings-and-celebrations', 'Weddings & Celebrations', 'Corporate & Events', 'weddings'],
    ['/corporate/conferences-and-venues', 'Conferences & Venues', 'Corporate & Events', 'venues'],
    ['/corporate/checklist', 'Corporate Planning Checklist', 'Corporate & Events'],
    ['/corporate/quote', 'Request a Quote', 'Corporate & Events'],
  ]],
];
const groups = GROUPS.map(([label, rows]) => ({ label, pages: rows.map(([key, title, eyebrow, banner]) => ({ key, title, eyebrow, banner: banner || '' })) }));
const all = groups.reduce((a, g) => a.concat(g.pages), []);
module.exports = { groups, all, byKey: Object.fromEntries(all.map((p) => [p.key, p])) };

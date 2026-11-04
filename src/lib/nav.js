'use strict';
const d = require('./data');

// Six menu items plus the Book Now button. Each dropdown has 8 links or fewer.
const nav = [
  {
    key: 'destinations', label: 'Destinations', href: '/destinations',
    links: [
      { label: 'All Destinations', href: '/destinations' },
      { label: 'The Farm', href: '/destinations/the-farm' },
      { label: 'Rendezvous Spaces', href: '/destinations/rendezvous-spaces' },
    ],
  },
  {
    key: 'things-to-do', label: 'Things To Do', href: '/things-to-do',
    links: [
      { label: 'Browse All Activities', href: '/things-to-do' },
      { label: 'Activity By Type', href: '/things-to-do', flyout: d.TYPES.map((t) => ({ label: t.name, href: `/things-to-do/type/${t.slug}`, count: d.typeActivities(t.slug).length })) },
      { label: 'Food & Drinks', href: '/things-to-do/food-and-drinks' },
      { label: 'New Activities', href: '/things-to-do/new' },
      { label: 'Upcoming Activities', href: '/things-to-do/upcoming' },
    ],
  },
  {
    key: 'stay', label: 'Stay', href: '/stay',
    links: [
      { label: 'Accommodation Overview', href: '/stay' },
      { label: 'Room Types & Rates', href: '/stay/rooms' },
      { label: 'Availability Calendar', href: '/stay/availability' },
      { label: 'Camping or Glamping', href: '/stay/camping-and-glamping' },
    ],
  },
  {
    key: 'breaks', label: 'Breaks & Packages', href: '/breaks',
    links: [
      { label: 'Seasonal Breaks', href: '/breaks/seasonal', flyout: d.breaks.seasonal.map((b) => ({ label: b.name, href: `/breaks/${b.slug}` })) },
      { label: 'Family & Child-Friendly Breaks', href: '/breaks/family' },
      { label: 'Signature Experiences', href: '/breaks/signature', flyout: d.breaks.signature.map((b) => ({ label: b.name, href: `/breaks/${b.slug}` })) },
      { label: 'Break Durations', href: '/breaks/durations', flyout: d.DURATIONS.map((x) => ({ label: x.name, href: `/breaks/durations#${x.slug}` })) },
    ],
  },
  {
    key: 'corporate', label: 'Corporate & Events', href: '/corporate',
    links: [
      { label: 'Meetings & Retreats', href: '/corporate/meetings-and-retreats' },
      { label: 'Team Building & Challenges', href: '/corporate/team-building' },
      { label: 'Nature & CSR Outings', href: '/corporate/nature-and-csr' },
      { label: 'Weddings & Celebrations', href: '/corporate/weddings-and-celebrations' },
      { label: 'Conferences & Venues', href: '/corporate/conferences-and-venues' },
      { label: 'Corporate Planning Checklist', href: '/corporate/checklist' },
      { label: 'Request a Quote', href: '/corporate/quote' },
    ],
  },
  {
    key: 'plan', label: 'Plan Your Visit', href: '/plan-your-visit',
    links: [
      { label: 'First Time at Destination Parcs', href: '/plan-your-visit/first-time' },
      { label: 'The D.P Experience', href: '/plan-your-visit/experience' },
      { label: 'Accessibility', href: '/plan-your-visit/accessibility' },
      { label: 'Contact & Directions', href: '/plan-your-visit/contact' },
    ],
  },
];

module.exports = nav;

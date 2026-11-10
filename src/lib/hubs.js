'use strict';
// The link cards on the Plan Your Visit and Corporate & Events pages. The admin can change the
// title, text and picture of each one (kept in pages.hubs, keyed by the card's link).
const data = require('./data');

const defaults = () => ({
  plan: [
    { href: '/plan-your-visit/first-time', icon: 'compass', title: 'First Time at Destination Parcs', text: 'How to get there, what to bring, opening hours, FAQs and safety tips.' },
    { href: '/plan-your-visit/experience', icon: 'heart', title: 'The D.P Experience', text: 'The story, the feel and the people behind the place.' },
    { href: '/plan-your-visit/accessibility', icon: 'users', title: 'Accessibility', text: 'Roads, parking, wheelchair access, toilets and family needs.' },
    { href: '/plan-your-visit/contact', icon: 'map-pin', title: 'Contact & Directions', text: 'Call, message or find us on the map.' },
  ],
  corporate: [
    { href: '/corporate/meetings-and-retreats', icon: 'briefcase', title: 'Meetings & Retreats', text: 'Board retreats, meetings, multi-day retreats and focused work sessions.' },
    { href: '/corporate/team-building', icon: 'users', title: 'Team Building & Challenges', text: `${((data.corporate || {}).teamBuilding || []).length} activities that build trust, strategy and spirit.` },
    { href: '/corporate/nature-and-csr', icon: 'leaf', title: 'Nature & CSR Outings', text: 'Bird watching, farm visits, forest walks and community tourism.' },
    { href: '/corporate/weddings-and-celebrations', icon: 'heart', title: 'Weddings & Celebrations', text: 'Weddings, traditional ceremonies and anniversary parties.' },
    { href: '/corporate/conferences-and-venues', icon: 'home', title: 'Conferences & Venues', text: 'Venue options, capacity and packages.' },
    { href: '/corporate/checklist', icon: 'download', title: 'Planning Checklist', text: 'A downloadable checklist to plan with confidence.' },
  ],
});

/** The cards for one page, with the admin's changes applied. */
function get(name) {
  const ov = (data.pages || {}).hubs || {};
  return (defaults()[name] || []).map((c) => ({ ...c, ...Object.fromEntries(Object.entries(ov[c.href] || {}).filter(([, v]) => v)) }));
}
module.exports = { get, defaults };

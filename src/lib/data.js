'use strict';
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'data');
const load = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

const site = load('site.json');
const act = load('activities.json');
const corporate = load('corporate.json');
const breaks = load('breaks.json');
const destinations = load('destinations.json').destinations;
const stay = load('stay.json');
const pages = load('pages.json');
const plan = load('plan.json');

// ---- activity types (each has its own landing page). tone = colour family in CSS
const TYPES = [
  { slug: 'outdoor', name: 'Outdoor', category: 'Outdoor', tone: 'leaf', icon: 'tree', blurb: 'Treetops, trails, wildlife and open-air games.' },
  { slug: 'indoor', name: 'Indoor', category: 'Indoor', tone: 'forest', icon: 'waves', blurb: 'Pool, table games, archery and pyjama parties.' },
  { slug: 'creative', name: 'Creative', category: 'Creative', tone: 'gold', icon: 'brush', blurb: 'Nature crafts, art and cooking with local flavours.' },
  { slug: 'sports-and-fitness', name: 'Sports & Fitness', category: 'Sports & Fitness', tone: 'leaf', icon: 'zap', blurb: 'Team sports, archery, trekking, cycling and yoga.' },
  { slug: 'family', name: 'Family', category: 'Family', tone: 'fresh', icon: 'users', blurb: 'Fun that works for every age in your group.' },
  { slug: 'children', name: 'Children', category: 'Children', tone: 'fresh', icon: 'egg', blurb: 'Bright, safe, hands-on fun for young explorers.' },
  { slug: 'seasonal', name: 'Seasonal', category: 'Seasonal', tone: 'bronze', icon: 'gift', blurb: 'Easter, Christmas and festive cosy nights.' },
  { slug: 'relaxing', name: 'Relaxing', category: 'Relaxing', tone: 'mist', icon: 'sun', blurb: 'Walks, yoga, sound bathing and campfires.' },
];
const typeBySlug = Object.fromEntries(TYPES.map((t) => [t.slug, t]));
const typeByCategory = Object.fromEntries(TYPES.map((t) => [t.category, t]));

const activities = act.activities.map((a) => ({
  ...a,
  types: a.categories.map((c) => typeByCategory[c]).filter(Boolean),
  tone: (typeByCategory[a.categories[0]] || { tone: 'leaf' }).tone,
  typeSlugs: a.categories.map((c) => (typeByCategory[c] || {}).slug).filter(Boolean),
}));
const actBySlug = Object.fromEntries(activities.map((a) => [a.slug, a]));
const hydrate = (list) => list.map((i) => ({ ...i, activity: i.slug ? actBySlug[i.slug] : null }));

// type -> activities and sub-groups
function typeActivities(typeSlug) {
  return activities.filter((a) => a.typeSlugs.includes(typeSlug));
}
function typeGroups(typeSlug) {
  const groups = act.groups[typeSlug];
  const all = typeActivities(typeSlug);
  if (!groups) return [{ name: 'All activities', items: all }];
  const used = new Set();
  const out = groups.map((g) => {
    const items = g.items.map((s) => actBySlug[s]).filter((a) => a && a.typeSlugs.includes(typeSlug));
    items.forEach((a) => used.add(a.slug));
    return { name: g.name, items };
  }).filter((g) => g.items.length);
  const rest = all.filter((a) => !used.has(a.slug));
  if (rest.length) out.push({ name: out.length ? 'More to enjoy' : 'All activities', items: rest });
  return out;
}

// ---- browse filters
const AGE_LABELS = { kids: 'Children', teens: 'Teens', adults: 'Adults' };
const DURATION_LABELS = { short: 'Up to 1 hour', medium: '1 to 2 hours', long: '2 hours or more', day: 'Half or full day', evening: 'Evening or overnight' };

function filterActivities(q) {
  let list = activities;
  const val = (k) => (typeof q[k] === 'string' ? q[k].trim() : '');
  const type = val('type');
  if (type && typeBySlug[type]) list = list.filter((a) => a.typeSlugs.includes(type));
  const age = val('age');
  if (AGE_LABELS[age]) list = list.filter((a) => a.ages.includes(age));
  const dur = val('duration');
  if (DURATION_LABELS[dur]) list = list.filter((a) => a.durationBucket === dur);
  const setting = val('setting');
  if (setting === 'Indoor' || setting === 'Outdoor') list = list.filter((a) => a.setting === setting);
  if (val('corporate') === '1') list = list.filter((a) => a.corporate);
  const cat = val('cat');
  if (cat && type && act.groups[type]) {
    const g = act.groups[type].find((x) => x.name.toLowerCase().startsWith(cat.toLowerCase()));
    if (g) list = list.filter((a) => g.items.includes(a.slug));
  }
  const s = val('q').toLowerCase();
  if (s) list = list.filter((a) => (a.name + ' ' + a.description).toLowerCase().includes(s));
  return list;
}

// ---- breaks
const allBreaks = [
  ...breaks.seasonal.map((b) => ({ ...b, group: 'Seasonal Breaks' })),
  ...breaks.other.map((b) => ({ ...b, group: 'Family & Child-Friendly Breaks' })),
  ...breaks.signature.map((b) => ({ ...b, group: 'Signature Experiences' })),
].map((b) => ({
  ...b,
  inclusions: hydrate(b.inclusions),
  blurb: b.feel || `${b.timing}. For ${String(b.guests || '').toLowerCase()}.`,
}));
const breakBySlug = Object.fromEntries(allBreaks.map((b) => [b.slug, b]));

// durations -> nights for the booking flow
const DURATIONS = [
  { slug: 'day-visit', name: 'Day Visit', nights: [0], length: '6 - 10 hrs', use: '' },
  { slug: 'overnight', name: 'Overnight', nights: [1], length: '1 night', use: '' },
  { slug: 'weekend', name: 'Weekend', nights: [2], length: '2 nights', use: '' },
  { slug: 'mid-week-stay', name: 'Mid-week Stay', nights: [3], length: '3 nights', use: '' },
  { slug: 'week-stay', name: 'Week Stay', nights: [5, 6, 7], length: '5 - 7 nights', use: '' },
].map((d) => {
  const src = breaks.durations.find((x) => x.name.toLowerCase().replace(/\s+/g, '-') === d.slug) || breaks.durations.find((x) => x.name.toLowerCase() === d.name.toLowerCase());
  return { ...d, length: src ? src.length : d.length, use: src ? src.use : '' };
});

const stayOptions = stay.options;
const stayBySlug = Object.fromEntries(stayOptions.map((s) => [s.slug, s]));

const corpTeam = corporate.teamBuilding.map((t) => ({ ...t, activity: actBySlug[t.slug] || null }));
const corpNature = corporate.nature.map((n) => ({
  ...n,
  activity: activities.find((a) => a.name.toLowerCase() === n.name.replace(/\s*\(.*\)/, '').toLowerCase()) || null,
}));

const newActivities = activities.filter((a) => a.isNew);
const upcomingActivities = activities.filter((a) => a.isUpcoming);

module.exports = {
  site, TYPES, typeBySlug, activities, actBySlug, typeActivities, typeGroups, filterActivities,
  AGE_LABELS, DURATION_LABELS, breaks, allBreaks, breakBySlug, DURATIONS, destinations, stayOptions, stayBySlug,
  corporate, corpTeam, corpNature, pages, plan, newActivities, upcomingActivities,
  hydrate,
};

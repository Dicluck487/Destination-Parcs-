'use strict';
const store = require('./store');
const data = require('./data');

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(parse(s).getTime());
const today = () => iso(new Date());

const ACTIVE = new Set(['pending', 'confirmed', 'change_requested', 'cancel_requested']);

/** Units already taken on a given night (night = date the guest sleeps). */
function taken(slug, date) {
  return store.bookings.filter((b) =>
    ACTIVE.has(b.status) && b.stay && b.stay.slug === slug && b.nights > 0 &&
    b.checkIn <= date && date < addDays(b.checkIn, b.nights)
  ).reduce((n, b) => n + (b.stay.units || 1), 0);
}

/** Does the stay fit every night of the request? */
function fits(slug, checkIn, nights, units) {
  const opt = data.stayBySlug[slug];
  if (!opt || !opt.units) return false;
  for (let i = 0; i < nights; i++) {
    if (taken(slug, addDays(checkIn, i)) + units > opt.units) return false;
  }
  return true;
}

function month(slug, ym) {
  const opt = data.stayBySlug[slug];
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= days; d++) {
    const date = `${y}-${pad(m)}-${pad(d)}`;
    const total = opt.units;
    const free = Math.max(0, total - taken(slug, date));
    let status = 'available';
    if (date < today()) status = 'past';
    else if (free === 0) status = 'full';
    else if (free <= Math.ceil(total * 0.3)) status = 'limited';
    out.push({ date, free, total, status });
  }
  return { slug, month: ym, startWeekday: first.getUTCDay(), days: out };
}

module.exports = { iso, parse, addDays, validDate, today, taken, fits, month };

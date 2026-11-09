'use strict';
// Derives filter fields from the plain text an editor types in the admin.

const slugify = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function durationBucket(txt) {
  const t = String(txt || '').toLowerCase();
  let hi = null;
  let m = t.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(hrs?|min)/);
  if (m) {
    hi = parseFloat(m[2]) * (m[3].startsWith('hr') ? 60 : 1);
  } else {
    m = t.match(/(\d+(?:\.\d+)?)\s*(hrs?|min)/);
    if (m) hi = parseFloat(m[1]) * (m[2].startsWith('hr') ? 60 : 1);
  }
  if (/evening|overnight/.test(t)) return 'evening';
  if (/half|full/.test(t)) return 'day';
  if (hi === null || hi <= 60) return 'short';
  if (hi <= 120) return 'medium';
  return 'long';
}

function ageTags(suit) {
  const t = String(suit || '').toLowerCase();
  const tags = new Set();
  if (t.includes('all ages')) ['kids', 'teens', 'adults'].forEach((x) => tags.add(x));
  if (/children|kids|young/.test(t)) tags.add('kids');
  if (t.includes('teen')) tags.add('teens');
  if (t.includes('adult')) tags.add('adults');
  if (t.includes('famil')) ['kids', 'teens', 'adults'].forEach((x) => tags.add(x));
  const m = t.match(/ages?\s*(\d+)\+/);
  if (m) { tags.add('teens'); tags.add('adults'); if (parseInt(m[1], 10) <= 10) tags.add('kids'); }
  if (/schools|groups|teams|corporate/.test(t)) { tags.add('teens'); tags.add('adults'); }
  if (!tags.size) { tags.add('teens'); tags.add('adults'); }
  return [...tags].sort();
}

function relatedFor(a, all) {
  return all.filter((b) => b.slug !== a.slug).map((b) => {
    const sc = a.categories.filter((c) => b.categories.includes(c)).length * 2 + (a.setting === b.setting ? 1 : 0) + (a.corporate && b.corporate ? 1 : 0);
    return { sc, name: b.name, slug: b.slug };
  }).sort((x, y) => (y.sc - x.sc) || x.name.localeCompare(y.name)).slice(0, 4).map((x) => x.slug);
}

module.exports = { slugify, durationBucket, ageTags, relatedFor };

'use strict';
const content = require('../../lib/content');
const data = require('../../lib/data');

/**
 * Save a content set and rebuild the public read-model. If the new content breaks the site
 * (bad shape from the raw editor, say) it is rolled back straight away and the error returned.
 */
function commit(req, name, obj, note) {
  const before = content.get(name);
  const who = (req.res.locals.adminUser || {}).username || 'admin';
  content.save(name, obj, `${note} (by ${who})`);
  try { data.reload(); return null; } catch (e) {
    content.save(name, before, `Rolled back after error: ${e.message}`);
    data.reload();
    return e;
  }
}

const uniqueSlug = (base, taken) => {
  let s = base || 'item'; let n = 2;
  while (taken.includes(s)) { s = `${base}-${n}`; n += 1; }
  return s;
};

module.exports = { commit, uniqueSlug };

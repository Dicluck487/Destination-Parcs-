(function () {
  'use strict';
  var form = document.querySelector('[data-wizard]');
  if (!form) return;
  var $ = function (s, r) { return (r || form).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || form).querySelectorAll(s)); };
  var steps = $$('[data-step]'), inds = $$('[data-step-ind]', document);
  var prev = $('[data-prev]'), next = $('[data-next]'), submit = $('[data-submit]');
  var breakMap = JSON.parse(form.dataset.breakMap || '{}');
  var stays = JSON.parse(form.dataset.stay || '[]');
  var cur = 1;

  var val = function (n) { var e = form.elements[n]; return e ? e.value : ''; };
  var radio = function (n) { var r = form.querySelector('input[name="' + n + '"]:checked'); return r; };

  function nightsFor() {
    var d = radio('duration'); if (!d) return null;
    var opts = d.dataset.nights.split(',').map(Number);
    return opts.length > 1 ? Number(val('nights')) : opts[0];
  }
  function stayInfo(slug) { return stays.filter(function (s) { return s.slug === slug; })[0]; }

  function syncDuration() {
    var d = radio('duration'); var wrap = $('[data-nights-wrap]');
    var multi = d && d.dataset.nights.indexOf(',') > -1;
    wrap.hidden = !multi;
    var n = nightsFor();
    $$('[data-stay-choice]').forEach(function (c) {
      var s = stayInfo(c.dataset.stayChoice);
      var dayOnly = s.units === 0, overnight = n > 0;
      var disable = (n === 0 && !dayOnly) || (overnight && dayOnly);
      c.classList.toggle('is-disabled', !!disable);
      var inp = c.querySelector('input');
      if (disable && inp.checked) inp.checked = false;
    });
    if (n === 0) { var ds = form.querySelector('input[name="stay"][value="no-stay"]'); if (ds) ds.checked = true; }
    if (n > 0) { var cs = radio('stay'); if (!cs || cs.value === 'no-stay') { var first = form.querySelector('[data-stay-choice]:not(.is-disabled) input'); if (first && first.value !== 'no-stay') first.checked = true; } }
    var hint = $('[data-dates-hint]'), ci = val('checkIn');
    if (hint) {
      if (n > 0 && ci) { var out = new Date(ci + 'T00:00:00Z'); out.setUTCDate(out.getUTCDate() + n); hint.textContent = 'Check-out: ' + out.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
      else if (n === 0 && ci) hint.textContent = 'Day visit: arrive and leave on the same day.';
      else hint.textContent = '';
    }
    syncStay();
  }

  function syncStay() {
    var s = radio('stay'); var info = s ? stayInfo(s.value) : null;
    var wrap = $('[data-units-wrap]'), avail = $('[data-avail]');
    var need = 1;
    if (info && info.units > 0) {
      wrap.hidden = false;
      $('[data-units-name]').textContent = info.name.toLowerCase();
      var guests = (Number(val('adults')) || 0) + (Number(val('children')) || 0);
      need = Math.max(1, Math.ceil(guests / Math.max(info.sleeps, 1)));
      var u = $('[data-units]'); if (Number(u.value) < need) u.value = need;
    } else { wrap.hidden = true; }
    avail.textContent = ''; avail.className = 'avail';
    var n = nightsFor(), ci = val('checkIn');
    if (info && info.units > 0 && n > 0 && ci) {
      var units = Number($('[data-units]').value) || 1;
      fetch('/api/check?slug=' + encodeURIComponent(info.slug) + '&checkIn=' + ci + '&nights=' + n + '&units=' + units, { credentials: 'same-origin' })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (j.ok === true) { avail.textContent = 'Available for your dates.'; avail.className = 'avail ok'; }
          else if (j.ok === false) { avail.textContent = 'Not available for all of those nights. Try other dates or another stay.'; avail.className = 'avail bad'; }
        }).catch(function () {});
    }
  }

  function updateCount() {
    var n = $$('input[name="activities"]:checked').length;
    var el = $('[data-act-count]'); if (el) el.textContent = n ? '(' + n + ' selected)' : '';
  }

  function review() {
    var el = $('[data-review]'); var d = radio('duration'), s = radio('stay'), l = radio('location');
    var brk = $('[data-break]'); var info = s ? stayInfo(s.value) : null;
    var acts = $$('input[name="activities"]:checked').map(function (c) { return c.closest('.acheck').querySelector('strong').textContent; });
    var n = nightsFor();
    var fmt = function (x) { return x ? new Date(x + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not chosen'; };
    var rows = [
      ['Location', l ? l.closest('.choice').querySelector('strong').textContent : 'Not chosen'],
      ['Break', brk && brk.value ? brk.options[brk.selectedIndex].text : 'Build my own break'],
      ['Duration', d ? d.closest('.choice').querySelector('strong').textContent + (n ? ' (' + n + ' night' + (n > 1 ? 's' : '') + ')' : '') : 'Not chosen'],
      ['Arrival', fmt(val('checkIn'))],
      ['Guests', (val('adults') || 0) + ' adults, ' + (val('children') || 0) + ' children'],
      ['Stay', info ? info.name + (info.units > 0 ? ' x ' + $('[data-units]').value : '') : 'Not chosen'],
      ['Activities', acts.length ? acts.join(', ') : 'None selected yet']
    ];
    el.innerHTML = '<dl class="summary">' + rows.map(function (r) {
      var wide = r[0] === 'Activities' ? ' class="summary__wide"' : '';
      var t = document.createElement('div'); t.textContent = r[1];
      return '<div' + wide + '><dt>' + r[0] + '</dt><dd>' + t.innerHTML + '</dd></div>';
    }).join('') + '</dl>';
  }

  function clearErr() { $$('.field-error').forEach(function (e) { e.classList.remove('field-error'); }); $$('.error-msg').forEach(function (e) { e.remove(); }); }
  function err(el, msg) {
    el.classList.add('field-error'); var p = document.createElement('p'); p.className = 'error-msg'; p.setAttribute('role', 'alert'); p.textContent = msg;
    var host = el.closest('.step'); host.insertBefore(p, host.children[1] || null); el.focus && el.focus();
    p.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function validate(step) {
    clearErr();
    if (step === 1 && !radio('location')) { err(form.querySelector('input[name="location"]'), 'Please choose a location.'); return false; }
    if (step === 2) {
      if (!radio('duration')) { err(form.querySelector('input[name="duration"]'), 'Please choose how long you would like to stay.'); return false; }
      var ci = val('checkIn'); var today = form.dataset.today;
      if (!ci || ci < today) { err($('[data-checkin]'), 'Please pick an arrival date that is today or later.'); return false; }
      if (!(Number(val('adults')) >= 1)) { err($('[data-adults]'), 'At least one adult is needed.'); return false; }
    }
    if (step === 3) {
      var s = radio('stay'); var n = nightsFor();
      if (!s) { err(form.querySelector('input[name="stay"]'), n > 0 ? 'Please choose where you would like to stay.' : 'Choose "Day visit" for a day trip.'); return false; }
      var av = $('[data-avail]'); if (av && av.classList.contains('bad')) { err(av, 'That stay is not available for your dates. Please change the dates or the stay.'); return false; }
    }
    return true;
  }

  function go(n) {
    cur = n;
    steps.forEach(function (s, i) { s.classList.toggle('is-current', i + 1 === n); });
    inds.forEach(function (li, i) { li.classList.toggle('is-active', i + 1 === n); li.classList.toggle('is-done', i + 1 < n); if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    prev.hidden = n === 1; next.hidden = n === steps.length; submit.hidden = n !== steps.length;
    if (n === steps.length) review();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  next.addEventListener('click', function () { if (validate(cur)) go(cur + 1); });
  prev.addEventListener('click', function () { go(cur - 1); });
  form.addEventListener('submit', function (e) { for (var s = 1; s <= 3; s++) { if (!validate(s)) { e.preventDefault(); go(s); return; } } });
  form.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') { e.preventDefault(); if (cur < steps.length) next.click(); } });

  $$('input[name="duration"]').forEach(function (r) { r.addEventListener('change', syncDuration); });
  ['nights'].forEach(function (n) { form.elements[n].addEventListener('change', syncDuration); });
  $('[data-checkin]').addEventListener('change', syncDuration);
  $('[data-adults]').addEventListener('input', syncStay); $('[data-children]').addEventListener('input', syncStay);
  $$('input[name="stay"]').forEach(function (r) { r.addEventListener('change', syncStay); });
  $('[data-units]').addEventListener('change', syncStay);

  $('[data-break]').addEventListener('change', function (e) {
    var list = breakMap[e.target.value];
    if (!list) return;
    $$('input[name="activities"]').forEach(function (c) { c.checked = list.indexOf(c.value) > -1 || c.checked; });
    updateCount();
  });
  form.addEventListener('change', function (e) { if (e.target.name === 'activities') updateCount(); });
  var search = $('[data-act-search]');
  if (search) search.addEventListener('input', function () {
    var q = search.value.trim().toLowerCase();
    $$('.acheck').forEach(function (a) { a.style.display = !q || a.dataset.actName.indexOf(q) > -1 ? '' : 'none'; });
    $$('[data-agroup]').forEach(function (g) { var any = $$('.acheck', g).some(function (a) { return a.style.display !== 'none'; }); g.style.display = any ? '' : 'none'; });
  });

  // initial state: if a package or quick-search already set things, start at the first step with something to confirm
  syncDuration(); updateCount();
  go(1);
})();

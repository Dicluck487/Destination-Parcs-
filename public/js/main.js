(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var csrf = (document.querySelector('input[name="_csrf"]') || {}).value || '';

  /* ---------- mobile menu + dropdown toggles ---------- */
  var menuBtn = $('[data-menu-btn]');
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
  }
  $$('.nav__toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.closest('.nav__item');
      var open = !li.classList.contains('is-open');
      $$('.nav__item.is-open').forEach(function (o) { if (o !== li) { o.classList.remove('is-open'); o.querySelector('.nav__toggle').setAttribute('aria-expanded', 'false'); } });
      li.classList.toggle('is-open', open);
      b.setAttribute('aria-expanded', String(open));
    });
  });
  $$('.flyout-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.closest('.has-flyout');
      var open = !li.classList.contains('is-open');
      li.classList.toggle('is-open', open);
      b.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    $$('.nav__item.is-open, .has-flyout.is-open').forEach(function (o) { o.classList.remove('is-open'); });
    document.body.classList.remove('menu-open', 'filters-shown');
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav__item')) $$('.nav__item.is-open').forEach(function (o) { o.classList.remove('is-open'); });
  });

  /* ---------- hero slider ---------- */
  var hero = $('[data-hero]');
  if (hero) {
    var slides = $$('[data-slide]', hero), dots = $$('[data-dot]', hero);
    var copy = []; try { copy = JSON.parse($('#hero-data').textContent); } catch (e) {}
    var title = $('[data-hero-title]', hero), sub = $('[data-hero-sub]', hero);
    var i = 0, timer = null, paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var show = function (n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
      slides.forEach(function (s, k) { var v = s.querySelector('video'); if (v) { if (k === i) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else { v.pause(); } } });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); d.setAttribute('aria-selected', String(k === i)); });
      if (copy[i] && title) {
        title.style.opacity = 0; sub.style.opacity = 0;
        setTimeout(function () { title.textContent = copy[i].headline; sub.textContent = copy[i].sub; title.style.opacity = 1; sub.style.opacity = 1; }, 300);
      }
    };
    var start = function () { stop(); if (!paused) timer = setInterval(function () { show(i + 1); }, 6500); };
    var stop = function () { if (timer) clearInterval(timer); timer = null; };
    dots.forEach(function (d) { d.addEventListener('click', function () { show(Number(d.dataset.dot)); start(); }); });
    var pauseBtn = $('[data-hero-pause]', hero);
    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      paused = !paused; hero.classList.toggle('is-paused', paused);
      pauseBtn.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
      paused ? stop() : start();
    });
    hero.addEventListener('mouseenter', stop); hero.addEventListener('mouseleave', start);
    if (paused) hero.classList.add('is-paused');
    start();
  }

  /* ---------- Add to my trip (no page reload) ---------- */
  var countEl = $('[data-trip-count]');
  var setCount = function (n) { if (!countEl) return; countEl.textContent = n; countEl.hidden = !n; };
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-trip-form]');
    if (!f || !window.fetch) return;
    e.preventDefault();
    var slug = f.querySelector('[name="slug"]').value;
    var adding = f.getAttribute('action').indexOf('/add') > -1;
    fetch(f.getAttribute('action'), {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ slug: slug })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error();
      setCount(j.count);
      // update every button for this activity on the page
      $$('[data-trip-form]').forEach(function (ff) {
        if (ff.querySelector('[name="slug"]').value !== slug) return;
        ff.setAttribute('action', '/trip/' + (adding ? 'remove' : 'add'));
        var b = ff.querySelector('[data-trip-btn]');
        b.classList.toggle('btn--leaf', adding); b.classList.toggle('btn--ghost', !adding);
        b.querySelector('span').textContent = adding ? 'In my trip' : 'Add to my trip';
        var svg = b.querySelector('svg');
        if (svg) svg.innerHTML = adding ? '<path d="M20 6 9 17l-5-5"/>' : '<path d="M12 5v14M5 12h14"/>';
      });
    }).catch(function () { f.submit(); });
  });

  /* ---------- confirm dialogs on forms ---------- */
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  /* ---------- browse filters ---------- */
  var ff = $('[data-filter-form]');
  if (ff) {
    var t;
    ff.addEventListener('change', function () { clearTimeout(t); t = setTimeout(function () { ff.submit(); }, 120); });
    var open = $('[data-filters-open]');
    if (open) open.addEventListener('click', function () { document.body.classList.add('filters-shown'); });
    document.addEventListener('click', function (e) { if (document.body.classList.contains('filters-shown') && !e.target.closest('.filters') && !e.target.closest('[data-filters-open]')) document.body.classList.remove('filters-shown'); });
  }

  /* ---------- photo / video gallery ---------- */
  $$('[data-gallery]').forEach(function (g) {
    var panels = $$('[data-gal-panel]', g), thumbs = $$('[data-gal-thumb]', g);
    var show = function (n) {
      panels.forEach(function (p, k) {
        var on = k === n; p.hidden = !on;
        $$('video', p).forEach(function (v) { if (!on) v.pause(); });
        var em = $('[data-embed]', p);
        if (em) {
          var f = $('iframe', em);
          if (on && !f) {
            f = document.createElement('iframe'); f.src = em.dataset.embed; f.title = em.dataset.title || 'Video';
            f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true; f.loading = 'lazy';
            em.appendChild(f);
          } else if (!on && f) { f.remove(); }
        }
      });
      thumbs.forEach(function (b, k) { b.classList.toggle('is-active', k === n); });
    };
    thumbs.forEach(function (b) { b.addEventListener('click', function () { show(Number(b.dataset.galThumb)); }); });
    show(0);
  });

  /* ---------- home gallery: the picture under the pointer grows to the large size, the others shrink ---------- */
  $$('[data-gallery-hover]').forEach(function (g) {
    var items = $$('.gallery__item', g);
    if (items.length !== 6 || !window.matchMedia || !window.Element.prototype.animate) return;
    var wide = window.matchMedia('(min-width: 821px) and (hover: hover)');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var blocks = [[1, 1], [2, 1], [1, 2], [2, 2]];           // top-left cell of each possible 2 x 2 block
    var cur = 0, pos = [], timer = null, busy = false;
    function layout(active, c0, r0) {                          // active picture takes the block, the rest fill the other 5 cells in order
      var out = [], cells = [], x, y;
      for (y = 1; y <= 3; y++) for (x = 1; x <= 3; x++) if (!(x >= c0 && x < c0 + 2 && y >= r0 && y < r0 + 2)) cells.push([x, y]);
      var k = 0;
      items.forEach(function (_, i) { out[i] = i === active ? { c: c0, r: r0, w: 2 } : { c: cells[k][0], r: cells[k++][1], w: 1 }; });
      return out;
    }
    function apply(l) { items.forEach(function (el, i) { el.style.setProperty('--c', l[i].c); el.style.setProperty('--r', l[i].r); el.style.setProperty('--w', l[i].w); }); }
    pos = layout(0, 1, 1);
    function go(active, instant) {
      if (active === cur && !instant) return;
      // choose a large block that covers the cell the picture is in now, so it grows under the pointer
      var at = pos[active], b = blocks[0], best = -1;
      blocks.forEach(function (bl) {
        var inside = at.c >= bl[0] && at.c < bl[0] + 2 && at.r >= bl[1] && at.r < bl[1] + 2;
        var score = inside ? (pos[cur].c === bl[0] && pos[cur].r === bl[1] ? 2 : 1) : 0;
        if (score > best) { best = score; b = bl; }
      });
      var before = items.map(function (el) { return el.getBoundingClientRect(); });
      cur = active; pos = layout(active, b[0], b[1]); apply(pos);
      if (instant || reduce.matches) return;
      busy = true;
      items.forEach(function (el, i) {
        var a = before[i], z = el.getBoundingClientRect();
        if (!z.width || !z.height) return;
        var sx = a.width / z.width, sy = a.height / z.height, dx = a.left - z.left, dy = a.top - z.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) return;
        var opt = { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' };
        el.classList.add('is-moving');
        el.style.transformOrigin = '0 0';
        var anim = el.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' }, { transform: 'none' }], opt);
        anim.onfinish = anim.oncancel = function () { el.classList.remove('is-moving'); el.style.transformOrigin = ''; busy = false; };
        // keep the picture and caption from looking stretched while the box resizes
        Array.prototype.forEach.call(el.children, function (ch) {
          var inv = [{ transform: 'scale(' + (1 / sx) + ',' + (1 / sy) + ')', transformOrigin: ch.tagName === 'FIGCAPTION' ? '0 100%' : '0 0' }, { transform: 'none', transformOrigin: ch.tagName === 'FIGCAPTION' ? '0 100%' : '0 0' }];
          ch.animate(inv, opt);
        });
      });
    }
    items.forEach(function (el, i) {
      el.addEventListener('mouseenter', function () {
        if (!wide.matches) return;
        clearTimeout(timer); timer = setTimeout(function () { go(i); }, 90);
      });
    });
    g.addEventListener('mouseleave', function () {
      clearTimeout(timer);
      if (!wide.matches) return;
      timer = setTimeout(function () { go(0); }, 250);
    });
    var onMq = function () { if (!wide.matches) { cur = 0; pos = layout(0, 1, 1); apply(pos); } };
    if (wide.addEventListener) wide.addEventListener('change', onMq);
  });

  /* ---------- full gallery page: album filter and viewer ---------- */
  $$('[data-gx]').forEach(function (grid) {
    var tiles = $$('.gx__item', grid), chips = $$('[data-gx-filter] .gx-chip');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var a = c.dataset.album;
        chips.forEach(function (x) { var on = x === c; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        tiles.forEach(function (t) { t.hidden = !(a === 'all' || t.dataset.album === a); });
      });
    });
    var box = null, list = [], at = 0, back = null;
    function shown() { return tiles.filter(function (t) { return !t.hidden && t.hasAttribute('data-gx-open'); }); }
    function paint() {
      var t = list[at], st = $('.lb__stage', box), cap = $('.lb__cap', box), n = $('.lb__n', box), m;
      st.innerHTML = '';
      if (t.dataset.type === 'file') { m = document.createElement('video'); m.controls = true; m.autoplay = true; m.playsInline = true; m.src = t.dataset.src; }
      else { m = document.createElement('img'); m.src = t.dataset.src; m.alt = t.dataset.cap || ''; }
      st.appendChild(m);
      cap.textContent = t.dataset.cap || ''; n.textContent = (at + 1) + ' / ' + list.length;
      $('.lb__prev', box).hidden = $('.lb__next', box).hidden = list.length < 2;
    }
    function step(d) { at = (at + d + list.length) % list.length; paint(); }
    function close() {
      if (!box) return; box.hidden = true; $('.lb__stage', box).innerHTML = ''; document.body.style.overflow = '';
      document.removeEventListener('keydown', key); if (back) back.focus();
    }
    function key(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Tab') { var f = $$('button', box).filter(function (b) { return !b.hidden; }); if (!f.length) return; var i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    }
    function open(t) {
      if (!box) {
        box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Gallery viewer');
        box.innerHTML = '<button type="button" class="lb__btn lb__close" aria-label="Close"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>' +
          '<button type="button" class="lb__btn lb__prev" aria-label="Previous"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button>' +
          '<div class="lb__stage"></div><div class="lb__bar"><span class="lb__cap"></span><small class="lb__n"></small></div>' +
          '<button type="button" class="lb__btn lb__next" aria-label="Next"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button>';
        document.body.appendChild(box);
        $('.lb__close', box).addEventListener('click', close);
        $('.lb__prev', box).addEventListener('click', function () { step(-1); });
        $('.lb__next', box).addEventListener('click', function () { step(1); });
        box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('lb__stage')) close(); });
      }
      list = shown(); at = Math.max(0, list.indexOf(t)); back = t; box.hidden = false; document.body.style.overflow = 'hidden';
      paint(); document.addEventListener('keydown', key); $('.lb__close', box).focus();
    }
    tiles.forEach(function (t) { if (t.hasAttribute('data-gx-open')) t.addEventListener('click', function () { open(t); }); });
  });

  /* ---------- hero videos follow the active slide ---------- */
  $$('.hero__slide video').forEach(function (v) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); });
})();

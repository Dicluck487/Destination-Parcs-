/* Team area behaviour: media picker, repeating rows, confirmations, unsaved-changes guard. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var csrf = ($('meta[name=csrf]') || {}).content || '';
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var icons = {
    plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    play: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.5v15l13-7.5-13-7.5Z"/></svg>',
    x: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    up: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>',
    down: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
  };
  var thumbOf = function (u) { return typeof u === 'string' ? u.replace('/uploads/images/', '/uploads/thumbs/') : u; };
  var dirty = false;

  /* ---------- menu on small screens ---------- */
  var menuBtn = $('[data-ad-menu]');
  if (menuBtn) menuBtn.addEventListener('click', function () {
    var open = document.body.classList.toggle('ad-menu-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  /* ---------- confirm + autosubmit ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.dataset && f.dataset.confirm && !window.confirm(f.dataset.confirm)) { e.preventDefault(); return; }
    if (f.hasAttribute && f.hasAttribute('data-dirty-guard')) { reindexAll(f); dirty = false; }
  });
  $$('[data-autosubmit]').forEach(function (s) { s.addEventListener('change', function () { s.form.submit(); }); });

  /* ---------- unsaved changes ---------- */
  $$('form[data-dirty-guard]').forEach(function (f) {
    f.addEventListener('input', function () { dirty = true; });
    f.addEventListener('change', function () { dirty = true; });
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- repeating rows ---------- */
  function reindex(rep) {
    var prefix = rep.dataset.prefix;
    var re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\[[^\\]]*\\]');
    $$('[data-rep-row]', rep).forEach(function (row, i) {
      $$('[name]', row).forEach(function (f) { f.name = f.name.replace(re, prefix + '[' + i + ']'); });
    });
  }
  function reindexAll(scope) { $$('[data-repeat]', scope).forEach(reindex); }
  function addRow(rep) {
    var tpl = $('[data-rep-template]', rep), rows = $('[data-rep-rows]', rep);
    var holder = el('div'); holder.innerHTML = tpl.innerHTML.replace(/__i__/g, String($$('[data-rep-row]', rep).length));
    var row = holder.firstElementChild; rows.appendChild(row);
    initMedia(row); reindex(rep);
    var first = $('input[type=text],input:not([type]),textarea', row); if (first) first.focus();
  }
  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-rep-add]');
    if (add) { addRow(add.closest('[data-repeat]')); dirty = true; return; }
    var row = e.target.closest('[data-rep-row]');
    if (!row) return;
    var rep = row.closest('[data-repeat]');
    if (e.target.closest('[data-rep-remove]')) { var min = Number(rep.getAttribute('data-min')) || 0; if (min && $$('[data-rep-row]', rep).length <= min) { window.alert(rep.getAttribute('data-min-msg') || 'This list must keep at least one item.'); return; } if (window.confirm('Remove this item?')) { row.remove(); reindex(rep); dirty = true; } }
    else if (e.target.closest('[data-rep-up]') && row.previousElementSibling) { row.parentNode.insertBefore(row, row.previousElementSibling); reindex(rep); dirty = true; }
    else if (e.target.closest('[data-rep-down]') && row.nextElementSibling) { row.parentNode.insertBefore(row.nextElementSibling, row); reindex(rep); dirty = true; }
  });

  /* ---------- media picker ---------- */
  var KINDS = { image: 'image', images: 'image', video: 'video', videos: 'video,link', mixed: 'image,video,link' };
  var ACCEPT = { image: 'image/*', images: 'image/*', video: 'video/mp4,video/webm,video/quicktime', videos: 'video/mp4,video/webm,video/quicktime', mixed: 'image/*,video/mp4,video/webm,video/quicktime' };
  var MULTI = { images: true, videos: true, mixed: true };

  function parse(field) {
    var mode = field.dataset.mode, raw = $('[data-mf-input]', field).value, out = [], v;
    try {
      if (mode === 'image' || mode === 'video') { if (raw) out.push({ t: mode === 'image' ? 'image' : 'file', u: raw }); }
      else {
        v = JSON.parse(raw || '[]');
        v.forEach(function (o) {
          if (mode === 'images') out.push({ t: 'image', u: o });
          else if (mode === 'videos') out.push({ t: o.kind, u: o.url, id: o.id, title: o.title });
          else out.push({ t: o.type, u: o.src, id: o.id, title: o.caption });
        });
      }
    } catch (e) { /* start empty */ }
    return out;
  }
  function serialise(field, items) {
    var mode = field.dataset.mode, v;
    if (mode === 'image' || mode === 'video') v = items[0] ? items[0].u : '';
    else if (mode === 'images') v = JSON.stringify(items.map(function (i) { return i.u; }));
    else if (mode === 'videos') v = JSON.stringify(items.map(function (i) { return { kind: i.t, url: i.u, id: i.id || '', title: i.title || '' }; }));
    else v = JSON.stringify(items.map(function (i) { return { type: i.t, src: i.u, id: i.id || '', caption: i.title || '' }; }));
    $('[data-mf-input]', field).value = v;
  }
  function render(field, items) {
    var list = $('[data-mf-list]', field), mode = field.dataset.mode;
    list.innerHTML = '';
    var addBtn = $('[data-mf-add]', field);
    if (!MULTI[mode]) addBtn.textContent = items.length ? 'Change' : addBtn.textContent;
    items.forEach(function (it, i) {
      var li = el('div', 'mf__item');
      var th = el('div', 'mf__thumb');
      if (it.t === 'image') th.innerHTML = '<img src="' + esc(thumbOf(it.u)) + '" alt="">';
      else if (it.t === 'file') th.innerHTML = '<video src="' + esc(it.u) + '#t=0.5" preload="metadata" muted playsinline></video>';
      else th.innerHTML = icons.play + '<small>' + (it.t === 'youtube' ? 'YouTube' : 'Vimeo') + '</small>';
      li.appendChild(th);
      var meta = el('div', 'mf__meta');
      if (mode === 'mixed' || mode === 'videos') {
        var inp = el('input'); inp.type = 'text'; inp.value = it.title || ''; inp.maxLength = 80;
        inp.placeholder = mode === 'mixed' ? 'Caption' : 'Title (optional)'; inp.setAttribute('aria-label', 'Caption');
        inp.addEventListener('input', function () { it.title = inp.value; serialise(field, items); dirty = true; });
        meta.appendChild(inp);
      } else meta.innerHTML = '<span>' + (it.t === 'image' ? 'Photo' : 'Video') + '</span>';
      li.appendChild(meta);
      var ctl = el('div', 'mf__ctl');
      var mk = function (cls, label, svg, fn) { var b = el('button', 'ad-icon ' + cls, svg); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', fn); return b; };
      if (MULTI[mode] && items.length > 1) {
        if (i > 0) ctl.appendChild(mk('', 'Move earlier', icons.up, function () { items.splice(i - 1, 0, items.splice(i, 1)[0]); sync(); }));
        if (i < items.length - 1) ctl.appendChild(mk('', 'Move later', icons.down, function () { items.splice(i + 1, 0, items.splice(i, 1)[0]); sync(); }));
      }
      ctl.appendChild(mk('ad-icon--danger', 'Remove', icons.x, function () { items.splice(i, 1); sync(); }));
      li.appendChild(ctl);
      list.appendChild(li);
    });
    function sync() { serialise(field, items); render(field, items); dirty = true; }
  }
  function initMedia(scope) {
    $$('[data-mf]', scope || document).forEach(function (field) {
      if (field.dataset.ready) return; field.dataset.ready = '1';
      var items = parse(field);
      render(field, items);
      $('[data-mf-add]', field).addEventListener('click', function () {
        openPicker(field.dataset.mode, function (picked) {
          if (!MULTI[field.dataset.mode]) items.length = 0;
          picked.forEach(function (p) { if (!items.some(function (x) { return x.u === p.u; })) items.push(p); });
          serialise(field, items); render(field, items); dirty = true;
        });
      });
    });
  }

  var dlg = null;
  function openPicker(mode, onUse) {
    if (!dlg) {
      dlg = el('dialog', 'pk');
      dlg.innerHTML =
        '<div class="pk__head"><h2>Choose from your library</h2><button type="button" class="ad-icon" data-pk-close aria-label="Close">' + icons.x + '</button></div>' +
        '<div class="pk__tools">' +
          '<input type="file" multiple hidden data-pk-file>' +
          '<button type="button" class="btn btn--gold btn--sm" data-pk-pick>Upload new</button>' +
          '<form class="pk__link" data-pk-link hidden><input type="url" placeholder="Paste a YouTube or Vimeo link" aria-label="YouTube or Vimeo link" required><button class="btn btn--ghost btn--sm" type="submit">Add link</button></form>' +
          '<progress max="100" value="0" hidden data-pk-progress></progress>' +
        '</div>' +
        '<p class="pk__msg" data-pk-msg role="status"></p>' +
        '<ul class="pk__grid" data-pk-grid></ul>' +
        '<div class="pk__foot"><span data-pk-count class="muted"></span><button type="button" class="btn btn--leaf" data-pk-use disabled>Use selected</button></div>';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
      $('[data-pk-close]', dlg).addEventListener('click', function () { dlg.close(); });
    }
    var grid = $('[data-pk-grid]', dlg), msg = $('[data-pk-msg]', dlg), useBtn = $('[data-pk-use]', dlg), count = $('[data-pk-count]', dlg);
    var fileIn = $('[data-pk-file]', dlg), prog = $('[data-pk-progress]', dlg), linkForm = $('[data-pk-link]', dlg);
    var kinds = KINDS[mode], multi = !!MULTI[mode], selected = [];
    fileIn.accept = ACCEPT[mode]; linkForm.hidden = kinds.indexOf('link') < 0;
    var fresh = function (node) { var c = node.cloneNode(true); node.parentNode.replaceChild(c, node); return c; };
    var pick = fresh($('[data-pk-pick]', dlg)), use = fresh(useBtn); linkForm = fresh(linkForm); fileIn = fresh(fileIn);
    fileIn.accept = ACCEPT[mode]; linkForm.hidden = kinds.indexOf('link') < 0; use.disabled = true;
    msg.textContent = ''; grid.innerHTML = '<li class="muted">Loading…</li>';

    function toItem(m) {
      if (m.kind === 'image') return { t: 'image', u: m.url };
      if (m.kind === 'video') return { t: 'file', u: m.url, title: m.title };
      return { t: m.linkKind, u: m.url, id: m.vid, title: m.title };
    }
    function refreshState() {
      use.disabled = !selected.length;
      count.textContent = selected.length ? selected.length + ' selected' : '';
      $$('.pk__card', grid).forEach(function (c) { var on = selected.indexOf(c._m.mid) >= 0; c.classList.toggle('is-sel', on); c.setAttribute('aria-pressed', String(on)); });
    }
    function card(m) {
      var li = el('li'); var b = el('button', 'pk__card'); b.type = 'button'; b._m = m;
      var inner = m.kind === 'image' ? '<img src="' + esc(m.thumb) + '" alt="" loading="lazy">'
        : m.kind === 'video' ? '<video src="' + esc(m.url) + '#t=0.5" preload="metadata" muted playsinline></video><span class="pk__tag">Video</span>'
        : '<span class="pk__ph">' + icons.play + '</span><span class="pk__tag">' + (m.linkKind === 'youtube' ? 'YouTube' : 'Vimeo') + '</span>';
      b.innerHTML = inner + '<span class="pk__name">' + esc(m.title) + '</span>';
      b.addEventListener('click', function () {
        var at = selected.indexOf(m.mid);
        if (!multi) { selected = at >= 0 ? [] : [m.mid]; } else if (at >= 0) selected.splice(at, 1); else selected.push(m.mid);
        refreshState();
      });
      li.appendChild(b); return li;
    }
    var library = [];
    function paint() {
      grid.innerHTML = '';
      if (!library.length) grid.innerHTML = '<li class="muted pk__empty">Nothing here yet. Use "Upload new" to add your first ' + (kinds === 'image' ? 'photo' : 'file') + '.</li>';
      library.forEach(function (m) { grid.appendChild(card(m)); });
      refreshState();
    }
    fetch('/admin/media/list.json?kinds=' + encodeURIComponent(kinds), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); }).then(function (j) { library = j.items; paint(); })
      .catch(function () { grid.innerHTML = '<li class="ad-error">Could not load the library. Refresh the page and try again.</li>'; });

    function add(items) { items.forEach(function (m) { if (kinds.indexOf(m.kind) >= 0) { if (!library.some(function (x) { return x.mid === m.mid; })) library.unshift(m); if (multi || !selected.length) { if (!multi) selected = [m.mid]; else selected.push(m.mid); } } }); paint(); }
    function send(files) {
      if (!files.length) return;
      var fd = new FormData(); files.forEach(function (f) { fd.append('files', f); });
      var xhr = new XMLHttpRequest(); xhr.open('POST', '/admin/media/upload'); xhr.setRequestHeader('X-CSRF-Token', csrf);
      prog.hidden = false; prog.value = 0; msg.textContent = 'Uploading…'; msg.className = 'pk__msg';
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) prog.value = Math.round(e.loaded / e.total * 100); };
      xhr.onload = function () {
        prog.hidden = true; var j = {}; try { j = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
        if (j.items && j.items.length) add(j.items);
        var errs = (j.errors || []).concat(j.error ? [j.error] : []);
        var nd = j.dups || 0, nn = (j.items ? j.items.length : 0) - nd;
        msg.textContent = errs.length ? errs.join(' ') : (j.items ? [nn > 0 ? nn + ' uploaded and ready to use.' : '', nd > 0 ? nd + (nd > 1 ? ' were' : ' was') + ' already in your library, so ' + (nd > 1 ? 'they were' : 'it was') + ' not added again.' : ''].filter(Boolean).join(' ') : 'The upload did not work.');
        msg.className = 'pk__msg' + (errs.length ? ' is-error' : '');
      };
      xhr.onerror = function () { prog.hidden = true; msg.textContent = 'The connection dropped during the upload. Please try again.'; msg.className = 'pk__msg is-error'; };
      xhr.send(fd);
    }
    pick.addEventListener('click', function () { fileIn.click(); });
    fileIn.addEventListener('change', function () { send(Array.prototype.slice.call(fileIn.files)); fileIn.value = ''; });
    linkForm.addEventListener('submit', function (e) {
      e.preventDefault(); var inp = $('input', linkForm);
      fetch('/admin/media/link', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ url: inp.value }) })
        .then(function (r) { return r.json(); }).then(function (j) {
          if (j.items) { add(j.items); inp.value = ''; msg.textContent = 'Link added.'; msg.className = 'pk__msg'; } else { msg.textContent = j.error || 'That link did not work.'; msg.className = 'pk__msg is-error'; }
        });
    });
    use.addEventListener('click', function () {
      var chosen = selected.map(function (id) { return library.filter(function (m) { return m.mid === id; })[0]; }).filter(Boolean).map(toItem);
      dlg.close(); onUse(chosen);
    });
    dlg.showModal();
  }

  /* ---------- library page: upload + link ---------- */
  var dz = $('[data-dropzone]');
  if (dz) {
    var fin = $('[data-lib-files]'), prog2 = $('[data-lib-progress]'), msg2 = $('[data-lib-msg]');
    var send2 = function (files) {
      if (!files.length) return;
      var fd = new FormData(); files.forEach(function (f) { fd.append('files', f); });
      var xhr = new XMLHttpRequest(); xhr.open('POST', '/admin/media/upload'); xhr.setRequestHeader('X-CSRF-Token', csrf);
      prog2.hidden = false; prog2.value = 0; msg2.textContent = 'Uploading ' + files.length + ' file' + (files.length > 1 ? 's' : '') + '…'; msg2.className = 'dz__msg';
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) prog2.value = Math.round(e.loaded / e.total * 100); };
      xhr.onload = function () {
        var j = {}; try { j = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
        var errs = (j.errors || []).concat(j.error ? [j.error] : []);
        if (errs.length) { prog2.hidden = true; msg2.textContent = errs.join(' '); msg2.className = 'dz__msg is-error'; if (j.items && j.items.length) setTimeout(function () { location.reload(); }, 2500); }
        else if (j.dups) { prog2.hidden = true; msg2.textContent = j.dups + (j.dups > 1 ? ' files were' : ' file was') + ' already in your library, so ' + (j.dups > 1 ? 'they were' : 'it was') + ' not added again.'; msg2.className = 'dz__msg'; setTimeout(function () { location.reload(); }, 2600); }
        else location.reload();
      };
      xhr.onerror = function () { prog2.hidden = true; msg2.textContent = 'The connection dropped during the upload. Please try again.'; msg2.className = 'dz__msg is-error'; };
      xhr.send(fd);
    };
    $('[data-lib-pick]').addEventListener('click', function () { fin.click(); });
    fin.addEventListener('change', function () { send2(Array.prototype.slice.call(fin.files)); });
    ['dragenter', 'dragover'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.add('is-over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.remove('is-over'); }); });
    dz.addEventListener('drop', function (e) { send2(Array.prototype.slice.call(e.dataTransfer.files)); });
    var lf = $('[data-lib-link]');
    lf.addEventListener('submit', function (e) {
      e.preventDefault();
      fetch('/admin/media/link', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ url: lf.elements.url.value, title: lf.elements.title.value }) })
        .then(function (r) { return r.json(); }).then(function (j) { if (j.items) location.reload(); else { msg2.textContent = j.error || 'That link did not work.'; msg2.className = 'dz__msg is-error'; } });
    });
  }

  initMedia(document);
})();

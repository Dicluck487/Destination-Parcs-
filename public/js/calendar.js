(function () {
  'use strict';
  var root = document.querySelector('[data-cal]');
  if (!root) return;
  var grid = root.querySelector('[data-cal-grid]'), title = root.querySelector('[data-cal-title]');
  var sel = root.querySelector('[data-cal-type]');
  var type = root.dataset.type;
  var now = new Date(); var y = now.getFullYear(), m = now.getMonth() + 1;
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function render(data) {
    grid.innerHTML = '';
    DOW.forEach(function (d) { var c = document.createElement('div'); c.className = 'cal__dow'; c.textContent = d; grid.appendChild(c); });
    for (var b = 0; b < data.startWeekday; b++) { var e = document.createElement('div'); e.className = 'cal__day cal__day--blank'; grid.appendChild(e); }
    data.days.forEach(function (d, idx) {
      var c = document.createElement('div');
      c.className = 'cal__day cal__day--' + d.status;
      c.setAttribute('role', 'gridcell');
      var label = d.status === 'past' ? 'Past' : d.status === 'full' ? 'Fully booked' : d.free + ' of ' + d.total + ' available';
      c.setAttribute('aria-label', (idx + 1) + ' ' + MONTHS[m - 1] + ': ' + label);
      c.innerHTML = '<span>' + (idx + 1) + '</span>' + (d.status === 'past' || d.status === 'full' ? '' : '<small>' + d.free + ' free</small>');
      grid.appendChild(c);
    });
  }
  function load() {
    title.textContent = MONTHS[m - 1] + ' ' + y;
    var ym = y + '-' + String(m).padStart(2, '0');
    fetch('/api/availability?type=' + encodeURIComponent(type) + '&month=' + ym, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); }).then(render)
      .catch(function () { grid.innerHTML = '<p>Could not load availability. Please try again.</p>'; });
  }
  root.querySelector('[data-cal-prev]').addEventListener('click', function () { m--; if (m < 1) { m = 12; y--; } load(); });
  root.querySelector('[data-cal-next]').addEventListener('click', function () { m++; if (m > 12) { m = 1; y++; } load(); });
  sel.addEventListener('change', function () { type = sel.value; history.replaceState(null, '', '?type=' + type); load(); });
  load();
})();

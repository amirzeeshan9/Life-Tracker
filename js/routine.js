/* ==========================================================================
   LifeOS — routine.js
   Daily Routine Tracker: activities, three-state tracking, day/week/month
   views, previous records and statistics.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};
  App.forms = App.forms || {};

  var util = App.util;
  var Store = App.Store;

  var state = { view: 'day', anchor: util.today() };
  var chart = null;

  /* ------------------------------------------------------------------ *
   * Period helpers
   * ------------------------------------------------------------------ */
  function periodDays() {
    if (state.view === 'day') return [state.anchor];
    if (state.view === 'week') {
      var start = util.weekStart(state.anchor);
      return Array.from({ length: 7 }, function (_, i) { return util.addDays(start, i); });
    }
    var first = util.startOfMonth(state.anchor);
    var count = util.daysInMonth(state.anchor);
    return Array.from({ length: count }, function (_, i) { return util.addDays(first, i); });
  }

  function periodLabel() {
    if (state.view === 'day') return util.longDate(state.anchor);
    if (state.view === 'week') {
      var days = periodDays();
      return util.shortDate(days[0]) + '  \u2013  ' + util.shortDate(days[6]);
    }
    return util.parse(state.anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function shiftPeriod(dir) {
    if (state.view === 'day') state.anchor = util.addDays(state.anchor, dir);
    else if (state.view === 'week') state.anchor = util.addDays(state.anchor, dir * 7);
    else {
      var d = util.parse(state.anchor);
      d.setMonth(d.getMonth() + dir, 1);
      state.anchor = util.key(d);
    }
  }

  /* ------------------------------------------------------------------ *
   * Cells
   * ------------------------------------------------------------------ */
  function cell(routine, dayKey, animate) {
    var scheduled = routine.days.indexOf(util.weekdayIndex(dayKey)) > -1;
    var status = Store.getState(routine.id, dayKey);
    var cls = 'rcell';
    if (!scheduled) cls += ' off';
    else if (status === 'done') cls += ' done';
    else if (status === 'missed') cls += ' missed';
    if (dayKey > util.today()) cls += ' future';
    if (animate) cls += ' just-set';

    var icon = status === 'done' ? 'check' : status === 'missed' ? 'x' : 'minus';
    var title = !scheduled ? 'Not scheduled on this day'
      : status === 'done' ? 'Completed' : status === 'missed' ? 'Missed' : 'Not marked';

    return '<button class="' + cls + '" data-routine="' + routine.id + '" data-day="' + dayKey + '" ' +
      'title="' + title + '" aria-label="' + util.escape(routine.name) + ' ' + dayKey + ' ' + title + '">' +
      '<i data-lucide="' + icon + '"></i></button>';
  }

  /* ------------------------------------------------------------------ *
   * Views
   * ------------------------------------------------------------------ */
  function renderDayView() {
    var routines = Store.routinesSorted();
    if (!routines.length) {
      return '<div class="routine-wrap"><div class="empty" style="margin:14px">' +
        '<i data-lucide="repeat"></i><strong>No routine activities yet</strong>' +
        '<p>Add activities like Workout, Study or Reading to begin tracking.</p></div></div>';
    }

    var dayKey = state.anchor;
    var scheduled = Store.routinesForDay(dayKey);
    var others = routines.filter(function (r) { return scheduled.indexOf(r) === -1; });

    function row(routine, off) {
      var status = Store.getState(routine.id, dayKey);
      return '' +
        '<div class="day-row' + (off ? ' is-off' : '') + '" data-row="' + routine.id + '">' +
          '<div class="day-row-body">' +
            '<strong>' + util.escape(routine.name) + '</strong>' +
            '<small>' + (off ? 'Not scheduled for this day' : 'Scheduled \u00b7 ' + util.relativeDay(dayKey)) + '</small>' +
          '</div>' +
          '<div class="seg-3">' +
            '<button class="' + (status === 'done' ? 'on-done' : '') + '" data-rdone="' + routine.id + '" title="Completed"><i data-lucide="check"></i></button>' +
            '<button class="' + (status === 'missed' ? 'on-missed' : '') + '" data-rmiss="' + routine.id + '" title="Missed"><i data-lucide="x"></i></button>' +
            '<button class="' + (!status ? 'on-none' : '') + '" data-rclear="' + routine.id + '" title="Not marked"><i data-lucide="minus"></i></button>' +
          '</div>' +
        '</div>';
    }

    return '' +
      '<div class="section-title" style="margin-top:0">Scheduled today</div>' +
      '<div class="day-list">' +
        (scheduled.length ? scheduled.map(function (r) { return row(r, false); }).join('')
          : '<div class="empty"><i data-lucide="calendar-off"></i><strong>Nothing scheduled</strong><p>No activities are set for this weekday. Manage your activities to add some.</p></div>') +
      '</div>' +
      (others.length
        ? '<div class="section-title">Not scheduled on this day</div><div class="day-list">' +
          others.map(function (r) { return row(r, true); }).join('') + '</div>'
        : '');
  }

  function renderWeekView() {
    var days = periodDays();
    var routines = Store.routinesSorted();
    var today = util.today();

    if (!routines.length) {
      return '<div class="routine-wrap"><div class="empty" style="margin:14px">' +
        '<i data-lucide="repeat"></i><strong>No routine activities yet</strong>' +
        '<p>Add your first activity to start tracking your consistency.</p></div></div>';
    }

    var head = '<tr><th class="routine-name">Activity</th>' + days.map(function (d) {
      var isToday = d === today;
      var future = d > today;
      return '<th class="' + (isToday ? 'is-today' : '') + '">' +
        util.DAY_LABELS[util.weekdayIndex(d)] +
        '<small>' + util.parse(d).getDate() + (future ? ' \u00b7' : '') + '</small></th>';
    }).join('') + '<th>Week</th></tr>';

    var body = routines.map(function (routine) {
      var counts = Store.routineCounts(routine.id, days);
      var pct = util.pct(counts.done, counts.tracked || counts.scheduled);
      return '<tr data-routine-row="' + routine.id + '" draggable="true">' +
        '<td class="routine-name"><div class="routine-name-inner">' +
          '<span class="drag-handle" title="Drag to reorder"><i data-lucide="grip-vertical"></i></span>' +
          '<strong>' + util.escape(routine.name) + '</strong>' +
        '</div></td>' +
        days.map(function (d) { return '<td>' + cell(routine, d) + '</td>'; }).join('') +
        '<td><span class="badge ' + (pct >= 70 ? 'solid-done' : pct >= 40 ? '' : 'solid-miss') + '">' + pct + '%</span></td>' +
        '</tr>';
    }).join('');

    return '' +
      '<div class="routine-wrap">' +
        '<div class="routine-scroll"><table class="routine-table">' +
          '<thead>' + head + '</thead><tbody>' + body + '</tbody>' +
        '</table></div>' +
        '<div class="legend">' +
          '<span class="legend-item"><span class="legend-swatch done"><i data-lucide="check"></i></span>Completed</span>' +
          '<span class="legend-item"><span class="legend-swatch missed"><i data-lucide="x"></i></span>Missed</span>' +
          '<span class="legend-item"><span class="legend-swatch off"><i data-lucide="minus"></i></span>Not marked / not scheduled</span>' +
          '<span class="legend-item">Click a day to cycle \u2713 \u2192 \u2715 \u2192 \u2013</span>' +
        '</div>' +
      '</div>' +
      '<div class="card glass chart-card mt-14">' +
        '<div class="card-head"><div><h3>Daily completion</h3><p class="card-sub">Percentage of scheduled activities completed each day</p></div></div>' +
        '<div class="chart-box"><canvas id="routineChart"></canvas></div>' +
      '</div>';
  }

  function renderMonthView() {
    var first = util.startOfMonth(state.anchor);
    var total = util.daysInMonth(state.anchor);
    var today = util.today();
    var routines = Store.routinesSorted();

    /* Calendar heat grid */
    var padStart = util.weekdayIndex(first);
    var cells = '';
    for (var p = 0; p < padStart; p++) cells += '<div class="cal-cell blank"></div>';

    for (var d = 1; d <= total; d++) {
      var key = util.addDays(first, d - 1);
      var isFuture = key > today;
      var dayRoutines = Store.routinesForDay(key);
      var done = 0, tracked = 0;
      dayRoutines.forEach(function (r) {
        var st = Store.getState(r.id, key);
        if (st === 'done') { done++; tracked++; }
        else if (st === 'missed') tracked++;
      });
      var pct = util.pct(done, tracked || dayRoutines.length);
      var level = isFuture || !tracked ? 0 : Math.min(4, Math.ceil(pct / 25));

      cells += '' +
        '<div class="cal-cell' + (level ? ' lvl-' + level : '') + (key === today ? ' is-today' : '') + '">' +
          '<div class="cal-day">' + d + '</div>' +
          '<div class="cal-bar"><i style="width:' + (isFuture ? 0 : pct) + '%"></i></div>' +
          '<div class="cal-stat">' + (isFuture ? '&nbsp;' : (tracked ? done + '/' + tracked : '0/0')) + '</div>' +
        '</div>';
    }

    var dows = util.DAY_LABELS.map(function (l) { return '<div class="cal-dow">' + l.slice(0, 1) + '</div>'; }).join('');

    /* Per-activity summary */
    var summary = routines.map(function (routine) {
      var days = periodDays();
      var c = Store.routineCounts(routine.id, days);
      var pct = util.pct(c.done, c.tracked || c.scheduled);
      var untracked = Math.max(0, c.scheduled - c.tracked);
      return '<tr>' +
        '<td class="routine-name"><strong>' + util.escape(routine.name) + '</strong></td>' +
        '<td><span class="badge solid-done">' + c.done + '</span></td>' +
        '<td><span class="badge solid-miss">' + c.missed + '</span></td>' +
        '<td><span class="badge">' + untracked + '</span></td>' +
        '<td><span class="badge ' + (pct >= 70 ? 'solid-done' : pct >= 40 ? '' : 'solid-miss') + '">' + pct + '%</span></td>' +
        '</tr>';
    }).join('');

    return '' +
      '<div class="card glass">' +
        '<div class="card-head"><div><h3>' + util.parse(first).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '</h3>' +
        '<p class="card-sub">Overall completion per day</p></div></div>' +
        '<div class="cal-grid">' + dows + cells + '</div>' +
        '<div class="legend" style="border:none;background:transparent;padding:12px 0 0">' +
          '<span class="legend-item"><span class="legend-swatch off" style="background:var(--field-bg-strong)"></span>Less</span>' +
          '<span class="legend-item"><span class="legend-swatch" style="background:color-mix(in srgb, var(--success) 12%, var(--field-bg))"></span>' +
          '<span class="legend-swatch" style="background:color-mix(in srgb, var(--success) 22%, var(--field-bg))"></span>' +
          '<span class="legend-swatch" style="background:color-mix(in srgb, var(--success) 34%, var(--field-bg))"></span>More</span>' +
        '</div>' +
      '</div>' +
      (routines.length ? '<div class="routine-wrap mt-14">' +
        '<div class="routine-scroll"><table class="routine-table">' +
          '<thead><tr><th class="routine-name">Activity</th><th>Completed</th><th>Missed</th><th>Not marked</th><th>Consistency</th></tr></thead>' +
          '<tbody>' + summary + '</tbody>' +
        '</table></div>' +
        '<div class="legend"><span class="legend-item">Only scheduled days count towards consistency</span></div>' +
      '</div>' : '') +
      '<div class="card glass chart-card mt-14">' +
        '<div class="card-head"><div><h3>Daily completion</h3><p class="card-sub">Percentage of scheduled activities completed each day this month</p></div></div>' +
        '<div class="chart-box"><canvas id="routineChart"></canvas></div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ *
   * Stats
   * ------------------------------------------------------------------ */
  function renderStats() {
    var days = periodDays();
    var totals = Store.rangeTotals(days);
    var periodPct = util.pct(totals.done, totals.tracked || totals.scheduled);

    var weekDays = Array.from({ length: 7 }, function (_, i) { return util.addDays(util.weekStart(util.today()), i); });
    var weekTotals = Store.rangeTotals(weekDays);
    var weekPct = util.pct(weekTotals.done, weekTotals.tracked || weekTotals.scheduled);

    var monthFirst = util.startOfMonth(util.today());
    var monthDays = Array.from({ length: util.daysInMonth(monthFirst) }, function (_, i) { return util.addDays(monthFirst, i); });
    var monthTotals = Store.rangeTotals(monthDays);
    var monthPct = util.pct(monthTotals.done, monthTotals.tracked || monthTotals.scheduled);

    function stat(icon, label, value, foot, tone) {
      return '<div class="stat ' + (tone ? 'is-' + tone : '') + '">' +
        '<div class="stat-top"><span class="stat-ico"><i data-lucide="' + icon + '"></i></span>' +
        '<span class="stat-label">' + label + '</span></div>' +
        '<div class="stat-value">' + value + '</div>' +
        '<div class="stat-foot">' + foot + '</div></div>';
    }

    document.getElementById('routineStats').innerHTML = [
      stat('check', 'Completed', String(totals.done), 'In selected period', 'success'),
      stat('x', 'Missed', String(totals.missed), 'In selected period', 'danger'),
      stat('percent', 'Completion', periodPct + '%', totals.tracked + ' of ' + totals.scheduled + ' days marked'),
      stat('calendar-range', 'Weekly consistency', weekPct + '%', 'This week'),
      stat('calendar-days', 'Monthly consistency', monthPct + '%', 'This month')
    ].join('');
  }

  /* ------------------------------------------------------------------ *
   * Chart
   * ------------------------------------------------------------------ */
  function drawChart() {
    var canvas = document.getElementById('routineChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (chart) { chart.destroy(); chart = null; }

    var days = periodDays();
    var today = util.today();
    var labels = [];
    var values = [];

    days.forEach(function (key) {
      var dayRoutines = Store.routinesForDay(key);
      var done = 0, tracked = 0;
      dayRoutines.forEach(function (r) {
        var st = Store.getState(r.id, key);
        if (st === 'done') { done++; tracked++; }
        else if (st === 'missed') tracked++;
      });
      labels.push(state.view === 'week'
        ? util.DAY_LABELS[util.weekdayIndex(key)]
        : String(util.parse(key).getDate()));
      values.push(key > today ? null : util.pct(done, tracked || dayRoutines.length));
    });

    var styles = getComputedStyle(document.documentElement);
    var accent = styles.getPropertyValue('--accent').trim() || '#a78bfa';
    var text3 = styles.getPropertyValue('--text-3').trim() || '#71717a';
    var border = styles.getPropertyValue('--border').trim() || 'rgba(255,255,255,.09)';

    chart = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Completion %',
          data: values,
          backgroundColor: accent,
          hoverBackgroundColor: accent,
          borderRadius: 6,
          maxBarThickness: 34,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 420 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = ctx.raw;
                return v == null ? 'No records' : v + '% completed';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: border },
            ticks: { color: text3, font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: border },
            border: { display: false },
            ticks: { color: text3, font: { size: 11 }, stepSize: 25, callback: function (v) { return v + '%'; } }
          }
        }
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Activity form
   * ------------------------------------------------------------------ */
  function openRoutineForm(existing) {
    var days = existing ? existing.days.slice() : [0, 1, 2, 3, 4, 5, 6];

    var dayButtons = util.DAY_LABELS.map(function (label, i) {
      var on = days.indexOf(i) > -1;
      return '<button type="button" class="btn btn-sm ' + (on ? 'btn-primary' : 'btn-ghost') + '" ' +
        'data-daytoggle="' + i + '">' + label + '</button>';
    }).join('');

    var body = '' +
      '<div class="field">' +
        '<label for="rfName">Activity name</label>' +
        '<input class="input" id="rfName" type="text" maxlength="80" placeholder="e.g. Workout" value="' +
          util.escape(existing ? existing.name : '') + '" />' +
      '</div>' +
      '<div class="field">' +
        '<label>Track on these days</label>' +
        '<div class="row" id="rfDays">' + dayButtons + '</div>' +
        '<p class="hint mt-8">Activities are only tracked on the selected weekdays.</p>' +
      '</div>' +
      '<div class="row">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-daypreset="all">Every day</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-daypreset="weekdays">Weekdays</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-daypreset="clear">Clear</button>' +
      '</div>';

    App.ui.modal({
      title: existing ? 'Edit activity' : 'New routine activity',
      subtitle: 'Track it consistently, every week',
      body: body,
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
              '<button class="btn btn-primary" id="rfSave"><i data-lucide="check"></i>' +
              (existing ? 'Save changes' : 'Add activity') + '</button>',
      onMount: function (root, close) {
        var selected = days.slice();
        var nameEl = root.querySelector('#rfName');
        var dayWrap = root.querySelector('#rfDays');
        setTimeout(function () { nameEl.focus(); }, 60);

        function paint() {
          dayWrap.querySelectorAll('[data-daytoggle]').forEach(function (btn) {
            var idx = parseInt(btn.getAttribute('data-daytoggle'), 10);
            var on = selected.indexOf(idx) > -1;
            btn.className = 'btn btn-sm ' + (on ? 'btn-primary' : 'btn-ghost');
          });
        }

        dayWrap.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-daytoggle]');
          if (!btn) return;
          var idx = parseInt(btn.getAttribute('data-daytoggle'), 10);
          var pos = selected.indexOf(idx);
          if (pos > -1) selected.splice(pos, 1); else selected.push(idx);
          paint();
        });

        root.querySelectorAll('[data-daypreset]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var preset = btn.getAttribute('data-daypreset');
            if (preset === 'all') selected = [0, 1, 2, 3, 4, 5, 6];
            else if (preset === 'weekdays') selected = [0, 1, 2, 3, 4];
            else selected = [];
            paint();
          });
        });

        root.querySelector('#rfSave').addEventListener('click', function () {
          var name = nameEl.value.trim();
          if (!name) {
            App.ui.toast('Please enter an activity name.', 'error');
            nameEl.focus();
            return;
          }
          if (!selected.length) {
            App.ui.toast('Select at least one day.', 'error');
            return;
          }
          Store.update(function (data) {
            if (existing) {
              var r = data.routines.find(function (x) { return x.id === existing.id; });
              if (r) {
                r.name = name;
                r.days = selected.slice().sort(function (a, b) { return a - b; });
              }
            } else {
              data.routines.push({
                id: util.uid('rt'),
                name: name,
                days: selected.slice().sort(function (a, b) { return a - b; }),
                order: data.routines.length,
                createdAt: new Date().toISOString()
              });
            }
          });
          App.ui.toast(existing ? 'Activity updated.' : 'Activity added.', 'success');
          close();
          Routine.render();
        });
      }
    });
  }

  function deleteRoutine(routine, onDone) {
    App.ui.confirm({
      title: 'Delete activity?',
      message: '"' + routine.name + '" and all of its tracking records will be removed permanently.',
      confirmText: 'Delete'
    }).then(function (ok) {
      if (!ok) return;
      Store.update(function (data) {
        data.routines = data.routines.filter(function (r) { return r.id !== routine.id; });
        delete data.routineRecords[routine.id];
        data.routines.forEach(function (r, i) { r.order = i; });
      });
      App.ui.toast('Activity deleted.', 'info');
      if (typeof onDone === 'function') onDone();
    });
  }

  function moveRoutine(id, dir) {
    Store.update(function (data) {
      var list = data.routines.slice().sort(function (a, b) { return a.order - b.order; });
      var index = list.findIndex(function (r) { return r.id === id; });
      var target = index + dir;
      if (index < 0 || target < 0 || target >= list.length) return;
      var tmp = list[index];
      list[index] = list[target];
      list[target] = tmp;
      list.forEach(function (r, i) { r.order = i; });
      data.routines = list;
    });
  }

  /* ------------------------------------------------------------------ *
   * Manage modal
   * ------------------------------------------------------------------ */
  function openManageModal() {
    var modal = App.ui.modal({
      title: 'Manage activities',
      subtitle: 'Add, rename, reorder or remove your daily routines',
      wide: true,
      body: '<div id="manageList"></div>',
      footer: '<button class="btn btn-ghost" data-close>Close</button>' +
              '<button class="btn btn-primary" id="manageAdd"><i data-lucide="plus"></i>Add activity</button>',
      onClose: function () { Routine.render(); },
      onMount: function (root, close) {
        var listEl = root.querySelector('#manageList');

        function paint() {
          var routines = Store.routinesSorted();
          if (!routines.length) {
            listEl.innerHTML = '<div class="empty"><i data-lucide="repeat"></i><strong>No activities</strong><p>Add your first routine activity to start tracking.</p></div>';
          } else {
            listEl.innerHTML = routines.map(function (r, i) {
              return '<div class="mini-item" style="padding:11px 12px">' +
                '<span class="mini-dot ' + (i % 2 ? 'low' : 'medium') + '"></span>' +
                '<span class="mini-text">' + util.escape(r.name) +
                  '<small>' + (r.days.length === 7 ? 'Every day' : r.days.map(function (d) { return util.DAY_LABELS[d]; }).join(', ')) + '</small>' +
                '</span>' +
                '<button class="tiny-btn" data-move="-1" data-routine="' + r.id + '" title="Move up"' + (i === 0 ? ' disabled' : '') + '><i data-lucide="chevron-up"></i></button>' +
                '<button class="tiny-btn" data-move="1" data-routine="' + r.id + '" title="Move down"' + (i === routines.length - 1 ? ' disabled' : '') + '><i data-lucide="chevron-down"></i></button>' +
                '<button class="tiny-btn" data-edit="' + r.id + '" title="Edit"><i data-lucide="pencil"></i></button>' +
                '<button class="tiny-btn danger" data-del="' + r.id + '" title="Delete"><i data-lucide="trash-2"></i></button>' +
                '</div>';
            }).join('');
          }
          App.ui.icons();
        }

        listEl.addEventListener('click', function (e) {
          var btn;
          if ((btn = e.target.closest('[data-move]'))) {
            moveRoutine(btn.getAttribute('data-routine'), parseInt(btn.getAttribute('data-move'), 10));
            paint();
            return;
          }
          if ((btn = e.target.closest('[data-edit]'))) {
            var r = Store.data.routines.find(function (x) { return x.id === btn.getAttribute('data-edit'); });
            if (r) { close(); openRoutineForm(r); }
            return;
          }
          if ((btn = e.target.closest('[data-del]'))) {
            var dr = Store.data.routines.find(function (x) { return x.id === btn.getAttribute('data-del'); });
            if (dr) deleteRoutine(dr, paint);
          }
        });

        root.querySelector('#manageAdd').addEventListener('click', function () {
          close();
          openRoutineForm(null);
        });

        paint();
      }
    });
    return modal;
  }

  /* ------------------------------------------------------------------ *
   * Drag and drop reordering (week table)
   * ------------------------------------------------------------------ */
  function bindDragAndDrop() {
    var tbody = document.querySelector('.routine-table tbody');
    if (!tbody) return;
    var dragId = null;

    tbody.querySelectorAll('tr[data-routine-row]').forEach(function (tr) {
      tr.addEventListener('dragstart', function (e) {
        dragId = tr.getAttribute('data-routine-row');
        tr.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragId); } catch (_) {}
      });
      tr.addEventListener('dragend', function () {
        tr.classList.remove('dragging');
        tbody.querySelectorAll('tr').forEach(function (r) { r.classList.remove('drop-target'); });
        dragId = null;
      });
      tr.addEventListener('dragover', function (e) {
        if (!dragId || dragId === tr.getAttribute('data-routine-row')) return;
        e.preventDefault();
        tr.classList.add('drop-target');
      });
      tr.addEventListener('dragleave', function () { tr.classList.remove('drop-target'); });
      tr.addEventListener('drop', function (e) {
        e.preventDefault();
        tr.classList.remove('drop-target');
        var targetId = tr.getAttribute('data-routine-row');
        if (!dragId || dragId === targetId) return;

        Store.update(function (data) {
          var list = data.routines.slice().sort(function (a, b) { return a.order - b.order; });
          var from = list.findIndex(function (r) { return r.id === dragId; });
          var to = list.findIndex(function (r) { return r.id === targetId; });
          if (from < 0 || to < 0) return;
          var moved = list.splice(from, 1)[0];
          list.splice(to, 0, moved);
          list.forEach(function (r, i) { r.order = i; });
          data.routines = list;
        });
        App.ui.toast('Order updated.', 'success');
        Routine.render();
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Status interactions
   * ------------------------------------------------------------------ */
  function setStatus(routineId, dayKey, status) {
    var routine = Store.data.routines.find(function (r) { return r.id === routineId; });
    if (!routine) return;
    var next = status === 'clear' ? null : status;
    var current = Store.getState(routineId, dayKey);
    if (current === next) next = null;
    Store.setState(routineId, dayKey, next);
  }

  /* ------------------------------------------------------------------ *
   * Page render
   * ------------------------------------------------------------------ */
  var Routine = {
    state: state,

    render: function () {
      if (chart) { chart.destroy(); chart = null; }

      var views = document.getElementById('routineViews');
      views.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-view') === state.view);
      });
      document.getElementById('routinePeriod').textContent = periodLabel();

      renderStats();

      var body = document.getElementById('routineBody');
      if (state.view === 'day') body.innerHTML = renderDayView();
      else if (state.view === 'week') body.innerHTML = renderWeekView();
      else body.innerHTML = renderMonthView();

      App.ui.icons();
      if (state.view !== 'day') {
        drawChart();
        if (state.view === 'week') bindDragAndDrop();
      }
    },

    setView: function (view) {
      state.view = view;
      this.render();
    },

    goToday: function () {
      state.anchor = util.today();
      this.render();
    },

    openForm: openRoutineForm,
    openManage: openManageModal
  };

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  function bind() {
    var views = document.getElementById('routineViews');
    if (views) {
      views.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-view]');
        if (btn) Routine.setView(btn.getAttribute('data-view'));
      });
    }

    var prev = document.getElementById('routinePrev');
    if (prev) prev.addEventListener('click', function () { shiftPeriod(-1); Routine.render(); });
    var next = document.getElementById('routineNext');
    if (next) next.addEventListener('click', function () { shiftPeriod(1); Routine.render(); });
    var todayBtn = document.getElementById('routineToday');
    if (todayBtn) todayBtn.addEventListener('click', function () { Routine.goToday(); });

    var addBtn = document.getElementById('addRoutineBtn');
    if (addBtn) addBtn.addEventListener('click', function () { openRoutineForm(null); });
    var manage = document.getElementById('manageRoutines');
    if (manage) manage.addEventListener('click', function () { openManageModal(); });

    var body = document.getElementById('routineBody');
    if (body) {
      body.addEventListener('click', function (e) {
        var btn;
        if ((btn = e.target.closest('.rcell[data-routine]'))) {
          if (btn.classList.contains('off')) return;
          var id = btn.getAttribute('data-routine');
          var day = btn.getAttribute('data-day');
          var routine = Store.data.routines.find(function (r) { return r.id === id; });
          if (!routine) return;
          var nextState = Store.cycleState(id, day);
          var cls = 'rcell' + (nextState === 'done' ? ' done' : nextState === 'missed' ? ' missed' : '') + ' just-set';
          if (day > util.today()) cls += ' future';
          btn.className = cls;
          btn.innerHTML = '<i data-lucide="' + (nextState === 'done' ? 'check' : nextState === 'missed' ? 'x' : 'minus') + '"></i>';
          App.ui.icons();
          var row = btn.closest('tr');
          if (row) {
            var counts = Store.routineCounts(id, periodDays());
            var pct = util.pct(counts.done, counts.tracked || counts.scheduled);
            var badge = row.querySelector('td:last-child .badge');
            if (badge) {
              badge.textContent = pct + '%';
              badge.className = 'badge ' + (pct >= 70 ? 'solid-done' : pct >= 40 ? '' : 'solid-miss');
            }
          }
          return;
        }
        if ((btn = e.target.closest('[data-rdone]'))) {
          setStatus(btn.getAttribute('data-rdone'), state.anchor, 'done'); Routine.render(); return;
        }
        if ((btn = e.target.closest('[data-rmiss]'))) {
          setStatus(btn.getAttribute('data-rmiss'), state.anchor, 'missed'); Routine.render(); return;
        }
        if ((btn = e.target.closest('[data-rclear]'))) {
          setStatus(btn.getAttribute('data-rclear'), state.anchor, 'clear'); Routine.render(); return;
        }
      });
    }
  }

  App.pages.routine = Routine;
  App.routine = Routine;
  App.forms.routine = openRoutineForm;

  document.addEventListener('DOMContentLoaded', bind);

})(window.LifeOS);

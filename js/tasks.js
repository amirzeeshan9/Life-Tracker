/* ==========================================================================
   LifeOS — tasks.js
   To-Do list: create, edit, delete, complete, search, filter, move dates.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};
  App.forms = App.forms || {};

  var util = App.util;
  var Store = App.Store;

  var state = {
    search: '',
    filter: 'all',
    priority: 'all',
    view: 'list',      // 'list' | 'month'
    monthAnchor: null, // YYYY-MM-DD inside the browsed month
    selectedDay: null  // YYYY-MM-DD shown in the month detail panel
  };

  /* ------------------------------------------------------------------ *
   * Data operations
   * ------------------------------------------------------------------ */
  function toggleTask(id) {
    var task = Store.data.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    Store.update(function () {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      task.updatedAt = new Date().toISOString();
    });
    App.ui.toast(task.completed ? 'Task completed. Nice work.' : 'Task reopened.', task.completed ? 'success' : 'info');
  }

  function deleteTask(id) {
    var task = Store.data.tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    App.ui.confirm({
      title: 'Delete task?',
      message: '"' + task.title + '" will be permanently removed.',
      confirmText: 'Delete'
    }).then(function (ok) {
      if (!ok) return;
      Store.update(function (data) {
        data.tasks = data.tasks.filter(function (t) { return t.id !== id; });
      });
      App.ui.toast('Task deleted.', 'info');
    });
  }

  function moveTask(id, newDate) {
    var task = Store.data.tasks.find(function (t) { return t.id === id; });
    if (!task || !util.isValidKey(newDate)) return;
    Store.update(function () {
      task.date = newDate;
      task.updatedAt = new Date().toISOString();
    });
    App.ui.toast('Moved to ' + util.relativeDay(newDate) + '.', 'success');
  }

  function clearCompleted() {
    var n = Store.data.tasks.filter(function (t) { return t.completed; }).length;
    if (!n) return;
    App.ui.confirm({
      title: 'Clear completed tasks?',
      message: n + ' completed task' + (n === 1 ? '' : 's') + ' will be permanently removed.',
      confirmText: 'Clear'
    }).then(function (ok) {
      if (!ok) return;
      Store.update(function (data) {
        data.tasks = data.tasks.filter(function (t) { return !t.completed; });
      });
      App.ui.toast(n + ' completed task' + (n === 1 ? '' : 's') + ' removed.', 'info');
    });
  }

  /* ------------------------------------------------------------------ *
   * Task form modal
   * ------------------------------------------------------------------ */
  function openTaskForm(opts) {
    opts = opts || {};
    var existing = opts.task || null;
    var presetDate = util.isValidKey(opts.date) ? opts.date : util.today();

    var body = '' +
      '<div class="field">' +
        '<label for="tfTitle">Task</label>' +
        '<input class="input" id="tfTitle" type="text" maxlength="200" placeholder="What needs to be done?" ' +
          'value="' + util.escape(existing ? existing.title : '') + '" />' +
      '</div>' +
      '<div class="field">' +
        '<label for="tfDesc">Description <span class="muted">(optional)</span></label>' +
        '<textarea class="input" id="tfDesc" maxlength="2000" placeholder="Add notes or details...">' +
          util.escape(existing ? existing.description : '') +
        '</textarea>' +
      '</div>' +
      '<div class="field-2">' +
        '<div class="field mb-0">' +
          '<label for="tfDate">Date</label>' +
          '<input class="input" id="tfDate" type="date" value="' + (existing ? existing.date : presetDate) + '" />' +
        '</div>' +
        '<div class="field mb-0">' +
          '<label for="tfPriority">Priority</label>' +
          '<select class="input select" id="tfPriority">' +
            ['high', 'medium', 'low'].map(function (p) {
              var sel = (existing ? existing.priority : 'medium') === p ? ' selected' : '';
              return '<option value="' + p + '"' + sel + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>';

    var footer = '' +
      '<button class="btn btn-ghost" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="tfSave">' +
        '<i data-lucide="check"></i>' + (existing ? 'Save changes' : 'Add task') +
      '</button>';

    var modal = App.ui.modal({
      title: existing ? 'Edit task' : 'New task',
      subtitle: existing ? 'Update the details of this task' : 'Add something to your plan',
      body: body,
      footer: footer,
      onMount: function (root, close) {
        var titleEl = root.querySelector('#tfTitle');
        setTimeout(function () { titleEl.focus(); }, 60);

        function submit() {
          var title = titleEl.value.trim();
          if (!title) {
            App.ui.toast('Please enter a task title.', 'error');
            titleEl.focus();
            return;
          }
          var desc = root.querySelector('#tfDesc').value.trim();
          var date = root.querySelector('#tfDate').value;
          var priority = root.querySelector('#tfPriority').value;
          if (!util.isValidKey(date)) date = util.today();

          Store.update(function (data) {
            if (existing) {
              var task = data.tasks.find(function (t) { return t.id === existing.id; });
              if (task) {
                task.title = title;
                task.description = desc;
                task.date = date;
                task.priority = priority;
                task.updatedAt = new Date().toISOString();
              }
            } else {
              data.tasks.push({
                id: util.uid('tk'),
                title: title,
                description: desc,
                date: date,
                priority: priority,
                completed: false,
                completedAt: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          });

          App.ui.toast(existing ? 'Task updated.' : 'Task added.', 'success');
          close();
        }

        root.querySelector('#tfSave').addEventListener('click', submit);
        root.querySelector('#tfTitle').addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
        });
      }
    });
    return modal;
  }

  /* ------------------------------------------------------------------ *
   * Move-to-date modal
   * ------------------------------------------------------------------ */
  function openMoveModal(task) {
    var body = '' +
      '<p class="hint mb-0">Choose a new date for <strong>' + util.escape(task.title) + '</strong>.</p>' +
      '<div class="field mt-14">' +
        '<label for="mvDate">New date</label>' +
        '<input class="input" id="mvDate" type="date" value="' + util.addDays(util.today(), 1) + '" />' +
      '</div>' +
      '<div class="row">' +
        '<button class="btn btn-ghost btn-sm" data-quickdate="' + util.today() + '">Today</button>' +
        '<button class="btn btn-ghost btn-sm" data-quickdate="' + util.addDays(util.today(), 1) + '">Tomorrow</button>' +
        '<button class="btn btn-ghost btn-sm" data-quickdate="' + util.addDays(util.today(), 7) + '">Next week</button>' +
      '</div>';

    App.ui.modal({
      title: 'Move task',
      body: body,
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
              '<button class="btn btn-primary" id="mvSave"><i data-lucide="calendar-check"></i>Move</button>',
      onMount: function (root, close) {
        var input = root.querySelector('#mvDate');
        root.querySelectorAll('[data-quickdate]').forEach(function (btn) {
          btn.addEventListener('click', function () { input.value = btn.getAttribute('data-quickdate'); });
        });
        root.querySelector('#mvSave').addEventListener('click', function () {
          if (!util.isValidKey(input.value)) {
            App.ui.toast('Pick a valid date.', 'error');
            return;
          }
          moveTask(task.id, input.value);
          close();
        });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Filtering + rendering
   * ------------------------------------------------------------------ */
  function matches(task) {
    if (state.priority !== 'all' && task.priority !== state.priority) return false;
    var today = util.today();
    if (state.filter === 'pending' && task.completed) return false;
    if (state.filter === 'completed' && !task.completed) return false;
    if (state.filter === 'overdue' && (task.completed || task.date >= today)) return false;

    if (state.search) {
      var q = state.search.toLowerCase();
      var haystack = (task.title + ' ' + task.description).toLowerCase();
      if (haystack.indexOf(q) === -1) return false;
    }
    return true;
  }

  function taskRow(task) {
    var today = util.today();
    var overdue = !task.completed && task.date < today;
    return '' +
      '<div class="task-item' + (task.completed ? ' is-done' : '') + (overdue ? ' is-overdue' : '') + '" data-id="' + task.id + '">' +
        '<button class="checkbox' + (task.completed ? ' is-checked' : '') + '" data-task-toggle="' + task.id + '" aria-label="Toggle complete">' +
          '<i data-lucide="check"></i>' +
        '</button>' +
        '<div class="task-body">' +
          '<div class="task-title">' + util.escape(task.title) + '</div>' +
          (task.description ? '<div class="task-desc">' + util.escape(task.description) + '</div>' : '') +
          '<div class="task-meta">' +
            '<span class="badge ' + task.priority + '">' + task.priority.charAt(0).toUpperCase() + task.priority.slice(1) + '</span>' +
            '<span class="muted"><i data-lucide="calendar"></i>' +
              (overdue ? 'Overdue &middot; ' : '') + util.relativeDay(task.date) +
            '</span>' +
            (task.completed && task.completedAt
              ? '<span class="muted"><i data-lucide="check-check"></i>Done ' + util.relativeTime(task.completedAt) + '</span>'
              : '') +
          '</div>' +
        '</div>' +
        '<div class="task-actions">' +
          '<button class="tiny-btn" data-task-move="' + task.id + '" title="Move to another date"><i data-lucide="calendar-clock"></i></button>' +
          '<button class="tiny-btn" data-task-edit="' + task.id + '" title="Edit task"><i data-lucide="pencil"></i></button>' +
          '<button class="tiny-btn danger" data-task-del="' + task.id + '" title="Delete task"><i data-lucide="trash-2"></i></button>' +
        '</div>' +
      '</div>';
  }

  function groupBlock(title, tasks, extraClass) {
    if (!tasks.length) return '';
    return '' +
      '<div class="task-group">' +
        '<div class="task-group-head ' + (extraClass || '') + '">' +
          '<h4>' + util.escape(title) + '</h4>' +
          '<span class="count">' + tasks.length + '</span>' +
        '</div>' +
        '<div class="task-items">' + tasks.map(taskRow).join('') + '</div>' +
      '</div>';
  }

  function sortByPriority(list) {
    var weight = { high: 0, medium: 1, low: 2 };
    return list.slice().sort(function (a, b) {
      if (weight[a.priority] !== weight[b.priority]) return weight[a.priority] - weight[b.priority];
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function emptyState() {
    if (state.search) {
      return '<div class="empty"><i data-lucide="search-x"></i><strong>No matching tasks</strong><p>Try a different search term or clear the filters.</p></div>';
    }
    if (state.filter !== 'all') {
      return '<div class="empty"><i data-lucide="filter"></i><strong>Nothing here</strong><p>No tasks match the current filter.</p></div>';
    }
    return '<div class="empty"><i data-lucide="list-checks"></i><strong>No tasks yet</strong><p>Add your first task to start planning your day.</p></div>';
  }

  /* ------------------------------------------------------------------ *
   * Monthly progress
   * ------------------------------------------------------------------ */
  function anchorKey() {
    return state.monthAnchor || util.today();
  }

  function monthName(key) {
    return util.parse(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function monthKeys(anchor) {
    var first = util.startOfMonth(anchor);
    var total = util.daysInMonth(anchor);
    var keys = [];
    for (var i = 0; i < total; i++) keys.push(util.addDays(first, i));
    return keys;
  }

  function shiftMonth(anchor, amount) {
    var d = util.parse(anchor);
    d.setDate(1);
    d.setMonth(d.getMonth() + amount);
    return util.key(d);
  }

  /** Completed / scheduled counts for one day. */
  function dayStat(key) {
    var dayTasks = Store.tasksOn(key);
    var done = dayTasks.filter(function (t) { return t.completed; }).length;
    return { key: key, total: dayTasks.length, done: done, pct: util.pct(done, dayTasks.length) };
  }

  function tsStat(icon, value, label, cls) {
    return '' +
      '<div class="ts-stat ' + (cls || '') + '">' +
        '<i data-lucide="' + icon + '"></i>' +
        '<div class="ts-body"><span class="ts-val">' + value + '</span>' +
          '<span class="ts-lbl">' + label + '</span></div>' +
      '</div>';
  }

  function renderSummary() {
    var el = document.getElementById('taskSummary');
    if (!el) return;
    var today = util.today();
    var done = 0, planned = 0;
    monthKeys(today).forEach(function (k) {
      var s = dayStat(k);
      done += s.done;
      planned += s.total;
    });
    var pct = util.pct(done, planned);
    var dueToday = Store.pendingOn(today).length;
    var overdue = Store.overdueTasks().length;
    var completed = Store.data.tasks.filter(function (t) { return t.completed; }).length;

    el.innerHTML = '' +
      '<div class="ts-lead">' +
        '<div class="ts-lead-top">' +
          '<h3>' + monthName(today) + ' progress</h3>' +
          '<span class="badge accent">' + pct + '%</span>' +
        '</div>' +
        '<div class="progress big"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
        '<p class="card-sub">' + done + ' of ' + planned + ' tasks completed this month</p>' +
      '</div>' +
      '<div class="ts-stats">' +
        tsStat('circle-dot', dueToday, 'Due today', '') +
        tsStat('alert-triangle', overdue, 'Overdue', overdue ? 'is-danger' : '') +
        tsStat('check-check', completed, 'Completed', 'is-success') +
      '</div>' +
      (completed ? '<button class="btn btn-ghost btn-sm ts-clear" data-task-clear-done>' +
        '<i data-lucide="eraser"></i>Clear completed</button>' : '');
    App.ui.icons();
  }

  function dayPanel(key) {
    var weight = { high: 0, medium: 1, low: 2 };
    var dayTasks = Store.tasksOn(key).slice().sort(function (a, b) {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return weight[a.priority] - weight[b.priority];
    });
    var done = dayTasks.filter(function (t) { return t.completed; }).length;

    return '' +
      '<div class="card glass mt-14">' +
        '<div class="card-head"><div>' +
          '<h3>' + util.longDate(key) + '</h3>' +
          '<p class="card-sub">' + (dayTasks.length
            ? done + ' of ' + dayTasks.length + ' ticked off'
            : 'Nothing scheduled for this day') + '</p>' +
        '</div></div>' +
        (dayTasks.length
          ? '<div class="task-items">' + dayTasks.map(taskRow).join('') + '</div>'
          : '<div class="empty"><i data-lucide="calendar-plus"></i><strong>No tasks</strong>' +
            '<p>Nothing was planned for this day.</p></div>') +
      '</div>';
  }

  function renderMonth() {
    var el = document.getElementById('taskMonth');
    if (!el) return;
    var anchor = anchorKey();
    var keys = monthKeys(anchor);
    var today = util.today();

    var done = 0, planned = 0;
    keys.forEach(function (k) {
      var s = dayStat(k);
      done += s.done;
      planned += s.total;
    });
    var pct = util.pct(done, planned);

    var pad = util.weekdayIndex(keys[0]);
    var cells = '';
    for (var p = 0; p < pad; p++) cells += '<div class="cal-cell blank"></div>';

    keys.forEach(function (key, i) {
      var s = dayStat(key);
      var future = key > today;
      var level = (!future && s.pct > 0) ? Math.max(1, Math.min(4, Math.ceil(s.pct / 25))) : 0;
      var cls = 'cal-cell is-clickable' +
        (level ? ' lvl-' + level : '') +
        (future ? ' is-future' : '') +
        (key === today ? ' is-today' : '') +
        (key === state.selectedDay ? ' is-selected' : '');
      cells += '' +
        '<div class="' + cls + '" data-month-day="' + key + '">' +
          '<div class="cal-day">' + (i + 1) + '</div>' +
          (s.total
            ? '<div class="cal-bar"><i style="width:' + s.pct + '%"></i></div>' +
              '<div class="cal-stat">' + s.done + '/' + s.total + '</div>'
            : '<div class="cal-stat cal-none">' + (future ? '&nbsp;' : '&mdash;') + '</div>') +
        '</div>';
    });

    var dows = util.DAY_LABELS.map(function (l) {
      return '<div class="cal-dow">' + l.slice(0, 1) + '</div>';
    }).join('');

    var html = '' +
      '<div class="card glass">' +
        '<div class="card-head"><div>' +
          '<h3>' + monthName(anchor) + '</h3>' +
          '<p class="card-sub">' + (planned
            ? done + ' of ' + planned + ' tasks ticked off &middot; ' + pct + '% complete'
            : 'No tasks scheduled this month yet') + '</p>' +
        '</div>' +
        '<div class="segmented month-nav">' +
          '<button data-month-shift="-1" title="Previous month"><i data-lucide="chevron-left"></i></button>' +
          '<button data-month-today title="Jump to this month">This month</button>' +
          '<button data-month-shift="1" title="Next month"><i data-lucide="chevron-right"></i></button>' +
        '</div></div>' +
        '<div class="progress big"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
        '<div class="cal-grid">' + dows + cells + '</div>' +
        '<div class="legend" style="border:none;background:transparent;padding:12px 0 0">' +
          '<span class="legend-item"><span class="legend-swatch off" style="background:var(--field-bg-strong)"></span>None</span>' +
          '<span class="legend-item">' +
            '<span class="legend-swatch" style="background:color-mix(in srgb, var(--success) 12%, var(--field-bg))"></span>' +
            '<span class="legend-swatch" style="background:color-mix(in srgb, var(--success) 22%, var(--field-bg))"></span>' +
            '<span class="legend-swatch" style="background:color-mix(in srgb, var(--success) 34%, var(--field-bg))"></span>' +
            'More complete</span>' +
        '</div>' +
      '</div>' +
      (state.selectedDay
        ? dayPanel(state.selectedDay)
        : '<div class="empty mt-14"><i data-lucide="mouse-pointer-click"></i><strong>Pick a day</strong>' +
          '<p>Select any day above to review and tick off its tasks.</p></div>');

    el.innerHTML = html;
    App.ui.icons();
  }

  var Tasks = {
    state: state,

    render: function () {
      var container = document.getElementById('taskList');
      var monthEl = document.getElementById('taskMonth');
      var summaryEl = document.getElementById('taskSummary');
      var isMonth = state.view === 'month';

      if (summaryEl) summaryEl.hidden = isMonth;
      if (container) container.hidden = isMonth;
      if (monthEl) monthEl.hidden = !isMonth;

      if (isMonth) {
        renderMonth();
        return;
      }
      if (!container) return;

      renderSummary();

      var all = Store.data.tasks.filter(matches);
      var today = util.today();
      var tomorrow = util.addDays(today, 1);

      var html = '';

      if (state.filter === 'overdue') {
        html = all.length
          ? groupBlock('Overdue', all, 'overdue')
          : emptyState();
      } else if (state.filter === 'completed') {
        var doneGroups = {};
        all.forEach(function (t) {
          if (!doneGroups[t.date]) doneGroups[t.date] = [];
          doneGroups[t.date].push(t);
        });
        var keys = Object.keys(doneGroups).sort(function (a, b) { return a < b ? 1 : -1; });
        html = keys.length
          ? keys.map(function (k) { return groupBlock(util.relativeDay(k) + ' \u00b7 ' + util.shortDate(k), doneGroups[k]); }).join('')
          : emptyState();
      } else {
        var pending = all.filter(function (t) { return !t.completed; });
        var completed = all.filter(function (t) { return t.completed; });

        var overdue = pending.filter(function (t) { return t.date < today; });
        var todayTasks = pending.filter(function (t) { return t.date === today; });
        var tomorrowTasks = pending.filter(function (t) { return t.date === tomorrow; });
        var later = pending.filter(function (t) { return t.date > tomorrow; });

        var laterGroups = {};
        later.forEach(function (t) {
          if (!laterGroups[t.date]) laterGroups[t.date] = [];
          laterGroups[t.date].push(t);
        });

        html += groupBlock('Overdue', sortByPriority(overdue), 'overdue');
        html += groupBlock('Today', sortByPriority(todayTasks), 'today');
        html += groupBlock('Tomorrow', sortByPriority(tomorrowTasks));
        Object.keys(laterGroups).sort().forEach(function (k) {
          html += groupBlock(util.longDate(k), sortByPriority(laterGroups[k]));
        });
        if (state.filter !== 'pending') {
          html += groupBlock('Completed', completed.slice().sort(function (a, b) {
            return new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt);
          }));
        }
        if (!html) html = emptyState();
      }

      container.innerHTML = html;
      App.ui.icons();
    },

    toggle: toggleTask,
    remove: deleteTask,
    move: moveTask,
    clearCompleted: clearCompleted,
    openForm: openTaskForm,
    openMove: openMoveModal
  };

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  function handleTaskClick(e) {
    var btn;
    if ((btn = e.target.closest('[data-task-toggle]'))) {
      btn.classList.add('pulse');
      toggleTask(btn.getAttribute('data-task-toggle'));
      return true;
    }
    if ((btn = e.target.closest('[data-task-edit]'))) {
      var t = Store.data.tasks.find(function (x) { return x.id === btn.getAttribute('data-task-edit'); });
      if (t) openTaskForm({ task: t });
      return true;
    }
    if ((btn = e.target.closest('[data-task-move]'))) {
      var m = Store.data.tasks.find(function (x) { return x.id === btn.getAttribute('data-task-move'); });
      if (m) openMoveModal(m);
      return true;
    }
    if ((btn = e.target.closest('[data-task-del]'))) {
      deleteTask(btn.getAttribute('data-task-del'));
      return true;
    }
    return false;
  }

  function bind() {
    var list = document.getElementById('taskList');
    if (list) {
      list.addEventListener('click', function (e) { handleTaskClick(e); });
    }

    var summary = document.getElementById('taskSummary');
    if (summary) {
      summary.addEventListener('click', function (e) {
        if (e.target.closest('[data-task-clear-done]')) clearCompleted();
      });
    }

    var month = document.getElementById('taskMonth');
    if (month) {
      month.addEventListener('click', function (e) {
        var btn;
        if ((btn = e.target.closest('[data-month-shift]'))) {
          state.monthAnchor = shiftMonth(anchorKey(), parseInt(btn.getAttribute('data-month-shift'), 10));
          state.selectedDay = null;
          renderMonth();
          return;
        }
        if (e.target.closest('[data-month-today]')) {
          state.monthAnchor = util.today();
          state.selectedDay = util.today();
          renderMonth();
          return;
        }
        if ((btn = e.target.closest('[data-month-day]'))) {
          state.selectedDay = btn.getAttribute('data-month-day');
          renderMonth();
          return;
        }
        handleTaskClick(e);
      });
    }

    var viewSwitch = document.getElementById('taskViewSwitch');
    if (viewSwitch) {
      viewSwitch.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-view]');
        if (!btn) return;
        state.view = btn.getAttribute('data-view');
        if (state.view === 'month') {
          state.monthAnchor = state.monthAnchor || util.today();
          state.selectedDay = state.selectedDay || util.today();
        }
        viewSwitch.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        Tasks.render();
      });
    }

    var search = document.getElementById('taskSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value.trim();
        Tasks.render();
      });
    }

    var filters = document.getElementById('taskFilters');
    if (filters) {
      filters.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-filter]');
        if (!btn) return;
        state.filter = btn.getAttribute('data-filter');
        filters.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        Tasks.render();
      });
    }

    var priority = document.getElementById('taskPriorityFilter');
    if (priority) {
      priority.addEventListener('change', function () {
        state.priority = priority.value;
        Tasks.render();
      });
    }
  }

  App.pages.tasks = Tasks;
  App.tasks = Tasks;
  App.forms.task = openTaskForm;

  document.addEventListener('DOMContentLoaded', bind);

})(window.LifeOS);

/* ==========================================================================
   LifeOS — planner.js
   Daily Planner: plan today, tomorrow or any future date.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var util = App.util;
  var Store = App.Store;

  var selected = util.today();

  function row(task, mode) {
    var today = util.today();
    var extraMove = '';
    if (mode === 'pending') {
      if (task.date !== today) {
        extraMove += '<button class="tiny-btn" data-move-to="' + today + '" data-task="' + task.id + '" title="Move to today"><i data-lucide="sun"></i></button>';
      }
      if (task.date !== util.addDays(today, 1)) {
        extraMove += '<button class="tiny-btn" data-move-to="' + util.addDays(today, 1) + '" data-task="' + task.id + '" title="Move to tomorrow"><i data-lucide="arrow-right"></i></button>';
      }
    }
    return '' +
      '<div class="task-item' + (task.completed ? ' is-done' : '') + '">' +
        '<button class="checkbox' + (task.completed ? ' is-checked' : '') + '" data-task-toggle="' + task.id + '" aria-label="Toggle complete">' +
          '<i data-lucide="check"></i>' +
        '</button>' +
        '<div class="task-body">' +
          '<div class="task-title">' + util.escape(task.title) + '</div>' +
          (task.description ? '<div class="task-desc">' + util.escape(task.description) + '</div>' : '') +
          '<div class="task-meta">' +
            '<span class="badge ' + task.priority + '">' + task.priority.charAt(0).toUpperCase() + task.priority.slice(1) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="task-actions">' +
          extraMove +
          '<button class="tiny-btn" data-task-edit="' + task.id + '" title="Edit"><i data-lucide="pencil"></i></button>' +
          '<button class="tiny-btn danger" data-task-del="' + task.id + '" title="Delete"><i data-lucide="trash-2"></i></button>' +
        '</div>' +
      '</div>';
  }

  var Planner = {
    getDate: function () { return selected; },

    render: function () {
      var today = util.today();
      var tasks = Store.tasksOn(selected);
      var pending = tasks.filter(function (t) { return !t.completed; });
      var done = tasks.filter(function (t) { return t.completed; });
      var pct = util.pct(done.length, tasks.length);

      /* Header / label */
      var label = util.relativeDay(selected) + (util.diffDays(selected, today) > 1 || util.diffDays(selected, today) < 0
        ? ' \u00b7 ' + util.shortDate(selected) : '');
      document.getElementById('plannerPendingTitle').textContent = 'Pending \u2014 ' + label;
      document.getElementById('plannerPendingSub').textContent =
        pending.length ? pending.length + ' to go \u00b7 ' + pct + '% complete' :
          (tasks.length ? 'All tasks completed' : 'Nothing planned yet');
      document.getElementById('plannerDoneSub').textContent = done.length + ' completed';
      document.getElementById('plannerBar').style.width = pct + '%';

      /* Sync controls */
      var dateInput = document.getElementById('plannerDate');
      if (dateInput.value !== selected) dateInput.value = selected;
      var quick = document.getElementById('plannerQuick');
      quick.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('is-active', util.addDays(today, parseInt(b.getAttribute('data-offset'), 10)) === selected);
      });

      var moveBtn = document.getElementById('plannerMoveUnfinished');
      if (moveBtn) {
        moveBtn.setAttribute('data-move-unfinished', util.addDays(selected, 1));
        moveBtn.hidden = !pending.length;
      }

      document.getElementById('plannerPending').innerHTML = pending.length
        ? pending.map(function (t) { return row(t, 'pending'); }).join('')
        : '<div class="empty"><i data-lucide="calendar-plus"></i><strong>Nothing planned</strong><p>' +
            (selected === today ? 'Plan your day by adding a task.' : 'Add tasks to prepare for ' + util.relativeDay(selected).toLowerCase() + '.') +
          '</p></div>';

      document.getElementById('plannerDone').innerHTML = done.length
        ? done.map(function (t) { return row(t, 'done'); }).join('')
        : '<div class="empty"><i data-lucide="circle-check"></i><strong>No completions yet</strong><p>Finished tasks will appear here.</p></div>';

      App.ui.icons();
    },

    goTo: function (key) {
      if (!util.isValidKey(key)) return;
      selected = key;
      this.render();
    },

    shift: function (amount) {
      selected = util.addDays(selected, amount);
      this.render();
    }
  };

  /* ------------------------------------------------------------------ *
   * Move every pending task of the current day to another date
   * ------------------------------------------------------------------ */
  function moveUnfinished(toKey) {
    var pending = Store.pendingOn(selected);
    if (!pending.length) {
      App.ui.toast('No unfinished tasks on this day.', 'info');
      return;
    }
    App.ui.confirm({
      title: 'Move unfinished tasks?',
      message: pending.length + ' pending task' + (pending.length === 1 ? '' : 's') + ' will be moved to ' +
        util.relativeDay(toKey).toLowerCase() + '.',
      confirmText: 'Move',
      danger: false
    }).then(function (ok) {
      if (!ok) return;
      Store.update(function () {
        pending.forEach(function (t) {
          t.date = toKey;
          t.updatedAt = new Date().toISOString();
        });
      });
      App.ui.toast(pending.length + ' task' + (pending.length === 1 ? '' : 's') + ' moved.', 'success');
    });
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  function bind() {
    var quick = document.getElementById('plannerQuick');
    if (quick) {
      quick.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-offset]');
        if (!btn) return;
        Planner.goTo(util.addDays(util.today(), parseInt(btn.getAttribute('data-offset'), 10)));
      });
    }

    var prev = document.getElementById('plannerPrev');
    if (prev) prev.addEventListener('click', function () { Planner.shift(-1); });
    var next = document.getElementById('plannerNext');
    if (next) next.addEventListener('click', function () { Planner.shift(1); });

    var dateInput = document.getElementById('plannerDate');
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        if (util.isValidKey(dateInput.value)) Planner.goTo(dateInput.value);
      });
    }

    var add = document.getElementById('plannerAdd');
    if (add) add.addEventListener('click', function () { App.forms.task({ date: selected }); });

    var body = document.getElementById('page-planner');
    if (body) {
      body.addEventListener('click', function (e) {
        var btn;
        if ((btn = e.target.closest('[data-task-toggle]'))) {
          btn.classList.add('pulse');
          App.tasks.toggle(btn.getAttribute('data-task-toggle'));
          return;
        }
        if ((btn = e.target.closest('[data-task-edit]'))) {
          var t = Store.data.tasks.find(function (x) { return x.id === btn.getAttribute('data-task-edit'); });
          if (t) App.forms.task({ task: t });
          return;
        }
        if ((btn = e.target.closest('[data-task-del]'))) {
          App.tasks.remove(btn.getAttribute('data-task-del'));
          return;
        }
        if ((btn = e.target.closest('[data-move-to]'))) {
          App.tasks.move(btn.getAttribute('data-task'), btn.getAttribute('data-move-to'));
        }
      });
    }

    // Bulk action is rendered next to the planner header on every render.
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-move-unfinished]');
      if (btn) moveUnfinished(btn.getAttribute('data-move-unfinished'));
    });
  }

  App.pages.planner = Planner;
  App.planner = Planner;

  document.addEventListener('DOMContentLoaded', bind);

})(window.LifeOS);

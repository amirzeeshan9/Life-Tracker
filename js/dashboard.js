/* ==========================================================================
   LifeOS — dashboard.js
   Overview page: greeting, live clock, stats and today's summaries.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var util = App.util;
  var Store = App.Store;

  function greeting(hour) {
    if (hour < 5) return 'Still up';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good night';
  }

  function headline(pending, routinesLeft) {
    if (pending === 0 && routinesLeft === 0) return 'Everything is done. Enjoy your evening.';
    if (pending === 0) return 'All tasks done — just a few routines left.';
    if (pending <= 2) return 'Nearly there. ' + pending + ' task' + (pending === 1 ? '' : 's') + ' left today.';
    return "Let's make today count.";
  }

  function statCard(opts) {
    return '' +
      '<div class="stat ' + (opts.tone ? 'is-' + opts.tone : '') + '">' +
        '<div class="stat-top">' +
          '<span class="stat-ico"><i data-lucide="' + opts.icon + '"></i></span>' +
          '<span class="stat-label">' + util.escape(opts.label) + '</span>' +
        '</div>' +
        '<div class="stat-value">' + util.escape(opts.value) + '</div>' +
        '<div class="stat-foot">' + util.escape(opts.foot || '') + '</div>' +
      '</div>';
  }

  function miniTask(task) {
    return '' +
      '<div class="mini-item' + (task.completed ? ' is-done' : '') + '">' +
        '<button class="checkbox' + (task.completed ? ' is-checked' : '') + '" ' +
          'data-task-toggle="' + task.id + '" aria-label="Toggle task">' +
          '<i data-lucide="check"></i>' +
        '</button>' +
        '<span class="mini-text">' + util.escape(task.title) +
          '<small>' + util.relativeDay(task.date) + ' &middot; ' + task.priority + ' priority</small>' +
        '</span>' +
        '<span class="mini-dot ' + task.priority + '"></span>' +
      '</div>';
  }

  function emptyMini(icon, text) {
    return '<div class="mini-item"><span class="mini-dot"></span><span class="mini-text muted">' + util.escape(text) + '</span></div>';
  }

  var Dashboard = {
    render: function () {
      var today = util.today();
      var name = Store.data.settings.displayName || 'Friend';

      /* Greeting + headline */
      var hour = new Date().getHours();
      document.getElementById('dashGreeting').textContent = greeting(hour) + ', ' + name;
      document.getElementById('dashDate').textContent = util.longDate(today);

      var todaysTasks = Store.tasksOn(today);
      var pending = todaysTasks.filter(function (t) { return !t.completed; });
      var doneTasks = todaysTasks.filter(function (t) { return t.completed; });

      var routines = Store.routinesForDay(today);
      var rCounts = { done: 0, missed: 0, tracked: 0, scheduled: 0 };
      routines.forEach(function (r) {
        var c = Store.routineCounts(r.id, [today]);
        rCounts.done += c.done;
        rCounts.missed += c.missed;
        rCounts.tracked += c.tracked;
        rCounts.scheduled += c.scheduled;
      });
      var routinesLeft = Math.max(0, routines.length - rCounts.tracked);
      document.getElementById('dashHeadline').textContent = headline(pending.length, routinesLeft);

      /* Stats */
      var routinePct = util.pct(rCounts.done, rCounts.tracked || rCounts.scheduled);
      var achToday = Store.achievementsOn(today);
      var overdue = Store.overdueTasks();

      document.getElementById('dashStats').innerHTML = [
        statCard({ icon: 'list-todo', label: "Today's Tasks", value: String(todaysTasks.length), foot: 'Planned for today' }),
        statCard({ icon: 'circle-check', label: 'Completed', value: String(doneTasks.length), tone: 'success', foot: util.pct(doneTasks.length, todaysTasks.length) + '% of today' }),
        statCard({ icon: 'clock', label: 'Pending', value: String(pending.length), tone: pending.length ? 'warning' : '', foot: overdue.length ? overdue.length + ' overdue' : 'Nothing overdue' }),
        statCard({ icon: 'repeat', label: 'Routine Progress', value: routinePct + '%', tone: routinePct >= 60 ? 'success' : '', foot: rCounts.done + ' of ' + (rCounts.tracked || rCounts.scheduled) + ' marked' }),
        statCard({ icon: 'trophy', label: "Today's Wins", value: String(achToday.length), foot: achToday.length ? 'Keep it up' : 'Log your first win' })
      ].join('');

      /* Today's tasks */
      document.getElementById('dashTaskSub').textContent =
        todaysTasks.length ? doneTasks.length + ' of ' + todaysTasks.length + ' completed' : 'Nothing planned yet';
      var taskList = document.getElementById('dashTaskList');
      if (!todaysTasks.length) {
        taskList.innerHTML = emptyMini('circle', 'No tasks for today. Add one to get started.');
      } else {
        var ordered = pending.concat(doneTasks).slice(0, 6);
        taskList.innerHTML = ordered.map(miniTask).join('');
      }

      /* Routine progress */
      document.getElementById('dashRoutineSub').textContent =
        routines.length ? routines.length + ' activities scheduled today' : 'No activities scheduled today';
      var routineList = document.getElementById('dashRoutineList');
      if (!routines.length) {
        routineList.innerHTML = emptyMini('circle', 'Add routine activities in the Routine Tracker.');
      } else {
        routineList.innerHTML = routines.slice(0, 6).map(function (r) {
          var state = Store.getState(r.id, today);
          var cls = state === 'done' ? 'done' : state === 'missed' ? 'missed' : '';
          var label = state === 'done' ? 'Completed' : state === 'missed' ? 'Missed' : 'Not marked';
          return '' +
            '<div class="mini-item">' +
              '<span class="mini-dot ' + cls + '"></span>' +
              '<span class="mini-text">' + util.escape(r.name) + '<small>' + label + '</small></span>' +
              '<button class="tiny-btn" data-goto="routine" title="Open tracker"><i data-lucide="arrow-up-right"></i></button>' +
            '</div>';
        }).join('');
      }

      /* Upcoming */
      var upcoming = Store.upcomingTasks().slice(0, 6);
      document.getElementById('dashUpcoming').innerHTML = upcoming.length
        ? upcoming.map(miniTask).join('')
        : emptyMini('circle', 'Nothing scheduled ahead. Plan tomorrow in the Daily Planner.');

      /* Achievements */
      document.getElementById('dashAchSub').textContent =
        achToday.length ? achToday.length + ' logged today' : 'Nothing logged today yet';
      document.getElementById('dashAchievements').innerHTML = achToday.length
        ? achToday.slice(0, 6).map(function (a) {
            return '' +
              '<div class="mini-item">' +
                '<span class="mini-dot done"></span>' +
                '<span class="mini-text">' + util.escape(a.title) +
                  (a.description ? '<small>' + util.escape(a.description.slice(0, 70)) + '</small>' : '') +
                '</span>' +
              '</div>';
          }).join('')
        : emptyMini('circle', 'No achievements recorded today.');

      App.ui.icons();
    }
  };

  /* ------------------------------------------------------------------ *
   * Interactions
   * ------------------------------------------------------------------ */
  function toggleTask(id) {
    Store.update(function (data) {
      var task = data.tasks.find(function (t) { return t.id === id; });
      if (!task) return;
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      task.updatedAt = new Date().toISOString();
    });
  }

  function bind() {
    ['dashTaskList', 'dashUpcoming'].forEach(function (id) {
      var container = document.getElementById(id);
      if (!container) return;
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-task-toggle]');
        if (!btn) return;
        toggleTask(btn.getAttribute('data-task-toggle'));
      });
    });
  }

  App.pages.dashboard = Dashboard;
  App.dashboard = Dashboard;

  document.addEventListener('DOMContentLoaded', bind);

})(window.LifeOS);

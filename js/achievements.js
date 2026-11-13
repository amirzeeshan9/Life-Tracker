/* ==========================================================================
   LifeOS — achievements.js
   My Achievements: record daily wins, browse and search past entries.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};
  App.forms = App.forms || {};

  var util = App.util;
  var Store = App.Store;

  var state = { filter: 'today', search: '' };

  /* ------------------------------------------------------------------ *
   * Form
   * ------------------------------------------------------------------ */
  function openAchievementForm(existing) {
    var body = '' +
      '<div class="field">' +
        '<label for="afTitle">What did you accomplish?</label>' +
        '<input class="input" id="afTitle" type="text" maxlength="160" placeholder="e.g. Solved a difficult coding problem" value="' +
          util.escape(existing ? existing.title : '') + '" />' +
      '</div>' +
      '<div class="field">' +
        '<label for="afDesc">Details <span class="muted">(optional)</span></label>' +
        '<textarea class="input" id="afDesc" maxlength="2000" placeholder="How did it go?">' +
          util.escape(existing ? existing.description : '') + '</textarea>' +
      '</div>' +
      '<div class="field mb-0">' +
        '<label for="afDate">Date</label>' +
        '<input class="input" id="afDate" type="date" value="' + (existing ? existing.date : util.today()) + '" />' +
      '</div>';

    App.ui.modal({
      title: existing ? 'Edit achievement' : 'Log an achievement',
      subtitle: existing ? 'Update this entry' : 'Celebrate what you got done today',
      body: body,
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
              '<button class="btn btn-primary" id="afSave"><i data-lucide="sparkles"></i>' +
              (existing ? 'Save changes' : 'Add achievement') + '</button>',
      onMount: function (root, close) {
        var titleEl = root.querySelector('#afTitle');
        setTimeout(function () { titleEl.focus(); }, 60);

        function submit() {
          var title = titleEl.value.trim();
          if (!title) {
            App.ui.toast('Please describe your achievement.', 'error');
            titleEl.focus();
            return;
          }
          var desc = root.querySelector('#afDesc').value.trim();
          var date = root.querySelector('#afDate').value;
          if (!util.isValidKey(date)) date = util.today();

          Store.update(function (data) {
            if (existing) {
              var a = data.achievements.find(function (x) { return x.id === existing.id; });
              if (a) { a.title = title; a.description = desc; a.date = date; }
            } else {
              data.achievements.push({
                id: util.uid('ac'),
                title: title,
                description: desc,
                date: date,
                createdAt: new Date().toISOString()
              });
            }
          });

          if (existing) {
            App.ui.toast('Achievement updated.', 'success');
          } else if (Store.data.settings.notifications.achievements) {
            App.ui.toast('Achievement recorded. Well done!', 'success', 'award');
          } else {
            App.ui.toast('Achievement recorded.', 'success');
          }
          close();
        }

        root.querySelector('#afSave').addEventListener('click', submit);
        titleEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
        });
      }
    });
  }

  function deleteAchievement(id) {
    var a = Store.data.achievements.find(function (x) { return x.id === id; });
    if (!a) return;
    App.ui.confirm({
      title: 'Delete achievement?',
      message: '"' + a.title + '" will be removed permanently.',
      confirmText: 'Delete'
    }).then(function (ok) {
      if (!ok) return;
      Store.update(function (data) {
        data.achievements = data.achievements.filter(function (x) { return x.id !== id; });
      });
      App.ui.toast('Achievement deleted.', 'info');
    });
  }

  /* ------------------------------------------------------------------ *
   * Filtering
   * ------------------------------------------------------------------ */
  function visible() {
    var today = util.today();
    var weekStart = util.weekStart(today);
    var list = Store.data.achievements.slice();

    if (state.filter === 'today') list = list.filter(function (a) { return a.date === today; });
    else if (state.filter === 'week') list = list.filter(function (a) { return a.date >= weekStart && a.date <= today; });

    if (state.search) {
      var q = state.search.toLowerCase();
      list = list.filter(function (a) {
        return (a.title + ' ' + a.description).toLowerCase().indexOf(q) > -1;
      });
    }

    return list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function card(a) {
    return '' +
      '<article class="ach-card">' +
        '<div class="ach-actions">' +
          '<button class="tiny-btn" data-ach-edit="' + a.id + '" title="Edit"><i data-lucide="pencil"></i></button>' +
          '<button class="tiny-btn danger" data-ach-del="' + a.id + '" title="Delete"><i data-lucide="trash-2"></i></button>' +
        '</div>' +
        '<span class="ach-date"><i data-lucide="calendar-check"></i>' + util.relativeDay(a.date) + '</span>' +
        '<h3 class="ach-title">' + util.escape(a.title) + '</h3>' +
        (a.description ? '<p class="ach-desc">' + util.escape(a.description) + '</p>' : '') +
      '</article>';
  }

  function groupByDate(list) {
    var groups = {};
    list.forEach(function (a) {
      if (!groups[a.date]) groups[a.date] = [];
      groups[a.date].push(a);
    });
    return Object.keys(groups)
      .sort(function (x, y) { return x < y ? 1 : -1; })
      .map(function (key) {
        return '<div class="section-title">' + util.relativeDay(key) + ' \u00b7 ' + util.longDate(key) +
          ' <span class="muted">(' + groups[key].length + ')</span></div>' +
          '<div class="ach-list">' + groups[key].map(card).join('') + '</div>';
      }).join('');
  }

  var Achievements = {
    render: function () {
      var container = document.getElementById('achievementList');
      if (!container) return;

      var list = visible();

      if (!list.length) {
        var msg = state.search
          ? { icon: 'search-x', title: 'No achievements found', text: 'Try another search term.' }
          : state.filter === 'today'
            ? { icon: 'trophy', title: 'Nothing logged today', text: 'Record something you accomplished — even the small wins count.' }
            : { icon: 'trophy', title: 'No achievements yet', text: 'Your accomplishments will be collected here.' };
        container.innerHTML = '<div class="empty"><i data-lucide="' + msg.icon + '"></i><strong>' +
          msg.title + '</strong><p>' + msg.text + '</p></div>';
        App.ui.icons();
        return;
      }

      container.innerHTML = state.filter === 'all'
        ? groupByDate(list)
        : '<div class="ach-list">' + list.map(card).join('') + '</div>';
      App.ui.icons();
    }
  };

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  function bind() {
    var filters = document.getElementById('achFilters');
    if (filters) {
      filters.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-filter]');
        if (!btn) return;
        state.filter = btn.getAttribute('data-filter');
        filters.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        Achievements.render();
      });
    }

    var search = document.getElementById('achSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value.trim();
        Achievements.render();
      });
    }

    var list = document.getElementById('achievementList');
    if (list) {
      list.addEventListener('click', function (e) {
        var btn;
        if ((btn = e.target.closest('[data-ach-edit]'))) {
          var a = Store.data.achievements.find(function (x) { return x.id === btn.getAttribute('data-ach-edit'); });
          if (a) openAchievementForm(a);
          return;
        }
        if ((btn = e.target.closest('[data-ach-del]'))) {
          deleteAchievement(btn.getAttribute('data-ach-del'));
        }
      });
    }
  }

  App.pages.achievements = Achievements;
  App.forms.achievement = openAchievementForm;

  document.addEventListener('DOMContentLoaded', bind);

})(window.LifeOS);

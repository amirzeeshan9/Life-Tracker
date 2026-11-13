/* ==========================================================================
   LifeOS — app.js
   Application shell: navigation, theme, sidebar, modals, toasts, bootstrap.
   ========================================================================== */

(function (App) {
  'use strict';

  var util = App.util;
  var Store = App.Store;

  var currentPage = 'dashboard';

  var PAGE_TITLES = {
    dashboard: 'Dashboard',
    tasks: 'To-Do List',
    planner: 'Daily Planner',
    routine: 'Daily Routine Tracker',
    achievements: 'My Achievements',
    notes: 'Quick Notes',
    settings: 'Settings'
  };

  /* ------------------------------------------------------------------ *
   * Icons
   * ------------------------------------------------------------------ */
  function icons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try { window.lucide.createIcons(); } catch (e) { /* non-fatal */ }
    }
  }

  /* ------------------------------------------------------------------ *
   * Toasts
   * ------------------------------------------------------------------ */
  function toast(message, type, iconName) {
    var root = document.getElementById('toastRoot');
    if (!root) return;

    var typeIcons = { success: 'check', error: 'x', info: 'info' };
    var kind = type || 'info';
    var icon = iconName || typeIcons[kind] || 'info';

    var el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = '<i data-lucide="' + icon + '"></i><span>' + util.escape(message) + '</span>';
    root.appendChild(el);
    icons();

    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
    }, 2600);
  }

  /* ------------------------------------------------------------------ *
   * Modal primitive
   * ------------------------------------------------------------------ */
  var openModals = [];

  function closeTopModal() {
    var top = openModals[openModals.length - 1];
    if (top) top.close();
  }

  function modal(opts) {
    opts = opts || {};
    var scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    scrim.innerHTML =
      '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal-head">' +
          '<div>' +
            '<h3>' + util.escape(opts.title || '') + '</h3>' +
            (opts.subtitle ? '<p>' + util.escape(opts.subtitle) + '</p>' : '') +
          '</div>' +
          '<button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button>' +
        '</div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
      '</div>';

    document.getElementById('modalRoot').appendChild(scrim);
    icons();

    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      var i = openModals.indexOf(handle);
      if (i > -1) openModals.splice(i, 1);
      scrim.remove();
      if (!openModals.length) document.body.style.overflow = '';
      if (typeof opts.onClose === 'function') {
        try { opts.onClose(); } catch (e) { console.error(e); }
      }
    }

    var handle = { root: scrim, close: close };

    scrim.addEventListener('click', function (e) {
      if (e.target === scrim) close();
    });
    scrim.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', close);
    });

    openModals.push(handle);
    document.body.style.overflow = 'hidden';

    if (typeof opts.onMount === 'function') {
      try {
        opts.onMount(scrim, close);
      } catch (e) {
        console.error('LifeOS modal error:', e);
      }
    }

    return handle;
  }

  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }

      var danger = opts.danger !== false;
      modal({
        title: opts.title || 'Are you sure?',
        body: '<div class="confirm-icon"><i data-lucide="' + (danger ? 'trash-2' : 'check') + '"></i></div>' +
              '<p class="hint" style="font-size:13px">' + util.escape(opts.message || '') + '</p>',
        footer: '<button class="btn btn-ghost" data-confirm-no>Cancel</button>' +
                '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-confirm-yes>' +
                util.escape(opts.confirmText || 'Confirm') + '</button>',
        onClose: function () { done(false); },
        onMount: function (root, close) {
          root.querySelector('[data-confirm-no]').addEventListener('click', function () {
            done(false);
            close();
          });
          root.querySelector('[data-confirm-yes]').addEventListener('click', function () {
            done(true);
            close();
          });
          setTimeout(function () {
            var yes = root.querySelector('[data-confirm-yes]');
            if (yes) yes.focus();
          }, 60);
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  function updateThemeIcon() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    btn.innerHTML = '<i data-lucide="' + (theme === 'dark' ? 'moon' : 'sun') + '"></i>';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    icons();
  }

  function setTheme(theme, silent) {
    theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    Store.data.settings.theme = theme;
    Store.save(true);
    updateThemeIcon();
    if (!silent && App.pages[currentPage]) App.pages[currentPage].render();
  }

  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(next);
  }

  /* ------------------------------------------------------------------ *
   * Sidebar
   * ------------------------------------------------------------------ */
  function applySidebarState() {
    var collapsed = !!Store.data.settings.sidebarCollapsed;
    document.getElementById('app').classList.toggle('is-collapsed', collapsed);
  }

  function toggleCollapse() {
    var collapsed = !Store.data.settings.sidebarCollapsed;
    Store.data.settings.sidebarCollapsed = collapsed;
    Store.save(true);
    applySidebarState();
  }

  function openDrawer() {
    document.getElementById('app').classList.add('is-drawer-open');
    document.getElementById('scrim').classList.add('is-open');
  }

  function closeDrawer() {
    document.getElementById('app').classList.remove('is-drawer-open');
    document.getElementById('scrim').classList.remove('is-open');
  }

  /* ------------------------------------------------------------------ *
   * Navigation
   * ------------------------------------------------------------------ */
  function updateSubtitle() {
    var today = util.today();
    var text;
    switch (currentPage) {
      case 'dashboard':
        text = util.longDate(today);
        break;
      case 'tasks': {
        var pending = Store.data.tasks.filter(function (t) { return !t.completed; }).length;
        var overdue = Store.overdueTasks().length;
        text = pending + ' pending' + (overdue ? ' \u00b7 ' + overdue + ' overdue' : '');
        break;
      }
      case 'planner':
        text = 'Planning for ' + util.relativeDay(App.planner.getDate());
        break;
      case 'routine':
        text = 'Tracking ' + Store.data.routines.length + ' activities';
        break;
      case 'achievements':
        text = Store.data.achievements.length + ' recorded';
        break;
      case 'notes':
        text = Store.data.notes.length + ' notes';
        break;
      default:
        text = 'Preferences and data';
    }
    document.getElementById('pageSubtitle').textContent = text;
  }

  function navigate(page, opts) {
    if (!App.pages[page]) return;
    currentPage = page;

    document.querySelectorAll('.page').forEach(function (section) {
      section.classList.toggle('is-active', section.id === 'page-' + page);
    });

    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('is-active', item.getAttribute('data-page') === page);
    });

    document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || 'LifeOS';
    updateSubtitle();

    App.pages[page].render();

    closeDrawer();
    if (!opts || opts.scroll !== false) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ *
   * Quick add
   * ------------------------------------------------------------------ */
  function openQuickForm(kind) {
    var pageFor = { task: 'tasks', routine: 'routine', achievement: 'achievements', note: 'notes' };
    var target = pageFor[kind];
    if (target && target !== currentPage) navigate(target);

    if (kind === 'routine') App.routine.openForm(null);
    else if (App.forms[kind]) App.forms[kind](null);
  }

  function closeQuickMenu() {
    var menu = document.getElementById('quickAddMenu');
    if (menu) menu.hidden = true;
  }

  /* ------------------------------------------------------------------ *
   * Clock
   * ------------------------------------------------------------------ */
  function tickClock() {
    var now = new Date();
    var clock = document.getElementById('dashClock');
    var date = document.getElementById('dashClockDate');
    if (clock) {
      clock.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (date) {
      date.textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
    }
  }

  /* ------------------------------------------------------------------ *
   * Shared refresh
   * ------------------------------------------------------------------ */
  function updateSidebar() {
    var today = util.today();
    var total = Store.tasksOn(today);
    var done = total.filter(function (t) { return t.completed; }).length;
    var pct = util.pct(done, total.length);

    var bar = document.getElementById('sideBar');
    var pctEl = document.getElementById('sidePct');
    var foot = document.getElementById('sideFoot');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (foot) {
      foot.textContent = total.length
        ? done + ' of ' + total.length + ' tasks completed'
        : 'No tasks planned for today';
    }
  }

  function updateProfile() {
    var name = Store.data.settings.displayName || 'Friend';
    document.getElementById('profileName').textContent = name;
    document.getElementById('avatar').textContent = name.charAt(0).toUpperCase();
  }

  function refresh() {
    updateProfile();
    updateSidebar();
    updateSubtitle();
    if (App.pages[currentPage]) App.pages[currentPage].render();
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */
  function bindShell() {
    document.getElementById('nav').addEventListener('click', function (e) {
      var btn = e.target.closest('.nav-item');
      if (btn) navigate(btn.getAttribute('data-page'));
    });

    document.getElementById('collapseBtn').addEventListener('click', toggleCollapse);
    document.getElementById('menuBtn').addEventListener('click', openDrawer);
    document.getElementById('scrim').addEventListener('click', closeDrawer);

    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('profileBtn').addEventListener('click', function () { navigate('settings'); });

    var quickBtn = document.getElementById('quickAddBtn');
    var quickMenu = document.getElementById('quickAddMenu');
    quickBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      quickMenu.hidden = !quickMenu.hidden;
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.menu-wrap')) closeQuickMenu();
    });

    document.addEventListener('click', function (e) {
      var goto = e.target.closest('[data-goto]');
      if (goto) { navigate(goto.getAttribute('data-goto')); return; }
      var quick = e.target.closest('[data-quick]');
      if (quick) {
        closeQuickMenu();
        openQuickForm(quick.getAttribute('data-quick'));
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (openModals.length) closeTopModal();
        else if (document.getElementById('app').classList.contains('is-drawer-open')) closeDrawer();
        else closeQuickMenu();
      }
      // Quick add shortcut: Shift + N
      if (e.shiftKey && (e.key === 'N' || e.key === 'n') && !openModals.length) {
        var tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          App.forms.task(null);
        }
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 1024) closeDrawer();
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  function init() {
    Store.load();

    setTheme(Store.data.settings.theme, true);
    applySidebarState();
    updateProfile();
    bindShell();

    navigate('dashboard', { scroll: false });
    updateSidebar();
    tickClock();
    setInterval(tickClock, 1000);

    // Keep the shell — and the visible page — in sync with any data change.
    // The Routine Tracker is excluded on purpose: it patches its cells in place
    // so that check / cross transitions stay smooth and the chart does not flicker.
    Store.subscribe(function () {
      updateProfile();
      updateSidebar();
      updateSubtitle();
      if (currentPage !== 'routine' && App.pages[currentPage]) App.pages[currentPage].render();
    });

    icons();
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */
  App.ui = {
    icons: icons,
    toast: toast,
    modal: modal,
    confirm: confirmDialog
  };
  App.navigate = navigate;
  App.setTheme = setTheme;
  App.refresh = refresh;
  App.getPage = function () { return currentPage; };
  App.icons = icons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window.LifeOS);

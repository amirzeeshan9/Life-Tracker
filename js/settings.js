/* ==========================================================================
   LifeOS — settings.js
   Profile, appearance, notifications, data export / import / reset.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};

  var util = App.util;
  var Store = App.Store;

  function summary() {
    var c = Store.counts();
    return c.tasks + ' tasks \u00b7 ' + c.routines + ' routine activities \u00b7 ' +
      c.achievements + ' achievements \u00b7 ' + c.notes + ' notes';
  }

  var Settings = {
    render: function () {
      var s = Store.data.settings;

      var nameInput = document.getElementById('setName');
      if (nameInput && document.activeElement !== nameInput) nameInput.value = s.displayName;

      var themeChoice = document.getElementById('themeChoice');
      themeChoice.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-theme-value') === s.theme);
      });

      document.getElementById('notifTasks').checked = s.notifications.tasks;
      document.getElementById('notifRoutine').checked = s.notifications.routine;
      document.getElementById('notifAch').checked = s.notifications.achievements;

      document.getElementById('dataSummary').textContent = summary();
    }
  };

  /* ------------------------------------------------------------------ *
   * Notifications
   * ------------------------------------------------------------------ */
  function setNotification(key, enabled, input) {
    if (!enabled) {
      Store.update(function (data) { data.settings.notifications[key] = false; });
      return;
    }

    if (typeof Notification === 'undefined') {
      input.checked = false;
      App.ui.toast('This browser does not support notifications.', 'error');
      return;
    }

    function finish(granted) {
      input.checked = granted;
      Store.update(function (data) { data.settings.notifications[key] = granted; });
      App.ui.toast(granted ? 'Notifications enabled.' : 'Notification permission was not granted.', granted ? 'success' : 'error');
    }

    if (Notification.permission === 'granted') { finish(true); return; }
    if (Notification.permission === 'denied') {
      finish(false);
      App.ui.toast('Notifications are blocked in your browser settings.', 'error');
      return;
    }
    Notification.requestPermission().then(function (perm) { finish(perm === 'granted'); });
  }

  function sendTestNotification() {
    if (typeof Notification === 'undefined') {
      App.ui.toast('This browser does not support notifications.', 'error');
      return;
    }
    function show() {
      try {
        new Notification('LifeOS', { body: 'Notifications are working. You are all set.' });
      } catch (e) {
        App.ui.toast('Notifications are working.', 'success');
      }
    }
    if (Notification.permission === 'granted') show();
    else if (Notification.permission === 'denied') App.ui.toast('Notifications are blocked in your browser settings.', 'error');
    else Notification.requestPermission().then(function (p) { if (p === 'granted') show(); });
  }

  /* ------------------------------------------------------------------ *
   * Export / Import
   * ------------------------------------------------------------------ */
  function exportData() {
    var json = Store.exportJSON();
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'lifeos-backup-' + util.today() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    App.ui.toast('Backup exported.', 'success');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        App.ui.toast('That file is not valid JSON.', 'error');
        return;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        App.ui.toast('That file does not look like a LifeOS backup.', 'error');
        return;
      }
      if (!parsed.tasks && !parsed.routines && !parsed.notes && !parsed.achievements && !parsed.settings) {
        App.ui.toast('No LifeOS data found in that file.', 'error');
        return;
      }

      App.ui.confirm({
        title: 'Replace current data?',
        message: 'Importing will overwrite everything currently stored in LifeOS on this device. ' +
          'Your current data will not be recoverable.',
        confirmText: 'Import and replace',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        Store.replace(parsed);
        App.setTheme(Store.data.settings.theme);
        App.refresh();
        App.ui.toast('Data imported successfully.', 'success');
      });
    };
    reader.onerror = function () { App.ui.toast('Could not read that file.', 'error'); };
    reader.readAsText(file);
  }

  function resetData() {
    App.ui.confirm({
      title: 'Reset all data?',
      message: 'Every task, routine record, achievement and note will be permanently deleted from this device.',
      confirmText: 'Delete everything',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      Store.reset();
      App.setTheme('dark');
      App.refresh();
      App.ui.toast('All data has been reset.', 'info');
    });
  }

  function loadDemo() {
    App.ui.confirm({
      title: 'Reload demo data?',
      message: 'This replaces your current data with a fresh set of sample tasks, routines and notes.',
      confirmText: 'Load demo data',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      Store.loadDemo();
      App.setTheme(Store.data.settings.theme);
      App.refresh();
      App.ui.toast('Demo data loaded.', 'success');
    });
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  function bind() {
    var save = document.getElementById('saveNameBtn');
    if (save) {
      save.addEventListener('click', function () {
        var input = document.getElementById('setName');
        var name = input.value.trim().slice(0, 40);
        if (!name) {
          App.ui.toast('Please enter a display name.', 'error');
          input.focus();
          return;
        }
        Store.update(function (data) { data.settings.displayName = name; });
        App.ui.toast('Display name updated.', 'success');
      });
    }

    var nameInput = document.getElementById('setName');
    if (nameInput) {
      nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') document.getElementById('saveNameBtn').click();
      });
    }

    var themeChoice = document.getElementById('themeChoice');
    if (themeChoice) {
      themeChoice.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-theme-value]');
        if (!btn) return;
        App.setTheme(btn.getAttribute('data-theme-value'));
        App.ui.toast('Theme updated.', 'info');
      });
    }

    ['notifTasks|tasks', 'notifRoutine|routine', 'notifAch|achievements'].forEach(function (pair) {
      var parts = pair.split('|');
      var el = document.getElementById(parts[0]);
      if (!el) return;
      el.addEventListener('change', function () { setNotification(parts[1], el.checked, el); });
    });

    var test = document.getElementById('testNotif');
    if (test) test.addEventListener('click', sendTestNotification);

    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    var importBtn = document.getElementById('importBtn');
    var importFile = document.getElementById('importFile');
    if (importBtn && importFile) {
      importBtn.addEventListener('click', function () { importFile.click(); });
      importFile.addEventListener('change', function () {
        if (importFile.files && importFile.files[0]) importData(importFile.files[0]);
        importFile.value = '';
      });
    }

    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetData);

    var demoBtn = document.getElementById('loadDemoBtn');
    if (demoBtn) demoBtn.addEventListener('click', loadDemo);
  }

  App.pages.settings = Settings;

  document.addEventListener('DOMContentLoaded', bind);

})(window.LifeOS);

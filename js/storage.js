/* ==========================================================================
   LifeOS — storage.js
   Data model, LocalStorage persistence, validation and shared helpers.
   ========================================================================== */

window.LifeOS = window.LifeOS || {};

(function (App) {
  'use strict';

  var STORAGE_KEY = 'lifeos.data.v1';
  var SCHEMA_VERSION = 1;

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */
  var util = {
    uid: function (prefix) {
      return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    /** Local-time date key: YYYY-MM-DD */
    key: function (date) {
      var d = date instanceof Date ? date : new Date();
      return d.getFullYear() + '-' + util.pad(d.getMonth() + 1) + '-' + util.pad(d.getDate());
    },

    pad: function (n) { return String(n).padStart(2, '0'); },

    /** Parse a YYYY-MM-DD key into a local Date (midnight) */
    parse: function (key) {
      var parts = String(key || '').split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) return new Date();
      return new Date(parts[0], parts[1] - 1, parts[2]);
    },

    today: function () { return util.key(new Date()); },

    addDays: function (key, amount) {
      var d = util.parse(key);
      d.setDate(d.getDate() + amount);
      return util.key(d);
    },

    /** Difference in whole days: a - b */
    diffDays: function (a, b) {
      var d1 = util.parse(a), d2 = util.parse(b);
      return Math.round((d1 - d2) / 86400000);
    },

    /** Monday-first index 0..6 */
    weekdayIndex: function (key) {
      return (util.parse(key).getDay() + 6) % 7;
    },

    /** Monday of the week containing `key` */
    weekStart: function (key) {
      return util.addDays(key, -util.weekdayIndex(key));
    },

    startOfMonth: function (key) {
      var d = util.parse(key);
      return d.getFullYear() + '-' + util.pad(d.getMonth() + 1) + '-01';
    },

    daysInMonth: function (key) {
      var d = util.parse(key);
      return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    },

    isValidKey: function (key) {
      return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && !isNaN(util.parse(key).getTime());
    },

    escape: function (str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    longDate: function (key) {
      return util.parse(key).toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    },

    shortDate: function (key) {
      return util.parse(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    },

    relativeDay: function (key) {
      var delta = util.diffDays(key, util.today());
      if (delta === 0) return 'Today';
      if (delta === 1) return 'Tomorrow';
      if (delta === -1) return 'Yesterday';
      if (delta > 1 && delta < 7) return util.parse(key).toLocaleDateString(undefined, { weekday: 'long' });
      return util.shortDate(key);
    },

    relativeTime: function (iso) {
      if (!iso) return '';
      var then = new Date(iso).getTime();
      var secs = Math.round((Date.now() - then) / 1000);
      if (secs < 60) return 'just now';
      var mins = Math.round(secs / 60);
      if (mins < 60) return mins + 'm ago';
      var hrs = Math.round(mins / 60);
      if (hrs < 24) return hrs + 'h ago';
      var days = Math.round(hrs / 24);
      if (days < 7) return days + 'd ago';
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    },

    pct: function (part, whole) {
      if (!whole) return 0;
      return Math.round((part / whole) * 100);
    }
  };

  var DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  util.DAY_LABELS = DAY_LABELS;
  util.DAY_FULL = DAY_FULL;

  /* ------------------------------------------------------------------ *
   * Default / empty state
   * ------------------------------------------------------------------ */
  function emptyData() {
    return {
      version: SCHEMA_VERSION,
      settings: {
        displayName: 'Friend',
        theme: 'dark',
        sidebarCollapsed: false,
        notifications: { tasks: false, routine: false, achievements: true }
      },
      tasks: [],
      routines: [],
      routineRecords: {},
      achievements: [],
      notes: [],
      meta: { createdAt: new Date().toISOString(), demo: false }
    };
  }

  /* ------------------------------------------------------------------ *
   * Demo data (first launch only)
   * ------------------------------------------------------------------ */
  function seedIds() {
    return {
      workout: util.uid('rt'),
      study: util.uid('rt'),
      coding: util.uid('rt'),
      reading: util.uid('rt'),
      water: util.uid('rt'),
      wake: util.uid('rt')
    };
  }

  function demoData() {
    var data = emptyData();
    var today = util.today();
    var tomorrow = util.addDays(today, 1);
    var ids = seedIds();

    data.settings.displayName = 'Amir';
    data.meta.demo = true;

    data.routines = [
      { id: ids.wake, name: 'Wake Up Early', days: [0, 1, 2, 3, 4, 5, 6], order: 0, createdAt: new Date().toISOString() },
      { id: ids.workout, name: 'Workout', days: [0, 2, 4, 5], order: 1, createdAt: new Date().toISOString() },
      { id: ids.study, name: 'Study', days: [0, 1, 2, 3, 4], order: 2, createdAt: new Date().toISOString() },
      { id: ids.coding, name: 'Coding Practice', days: [0, 1, 2, 3, 4, 5], order: 3, createdAt: new Date().toISOString() },
      { id: ids.reading, name: 'Reading', days: [0, 1, 2, 3, 4, 5, 6], order: 4, createdAt: new Date().toISOString() },
      { id: ids.water, name: 'Drink Enough Water', days: [0, 1, 2, 3, 4, 5, 6], order: 5, createdAt: new Date().toISOString() }
    ];

    // Build ~5 weeks of realistic history, leaving today untouched.
    var records = {};
    function seed(routineId, dayKey, forceMiss) {
      var r = Math.random();
      var state;
      if (forceMiss === true) state = 'missed';
      else if (forceMiss === false) state = 'done';
      else if (r < 0.66) state = 'done';
      else if (r < 0.84) state = 'missed';
      else state = null;
      if (!state) return;
      if (!records[routineId]) records[routineId] = {};
      records[routineId][dayKey] = state;
    }

    data.routines.forEach(function (routine) {
      for (var back = 1; back <= 34; back++) {
        var dk = util.addDays(today, -back);
        if (routine.days.indexOf(util.weekdayIndex(dk)) === -1) continue;
        seed(routine.id, dk, null);
      }
    });
    // Make a couple of recent days look consistently good for the demo.
    ['-1', '-2', '-3'].forEach(function (offset) {
      data.routines.forEach(function (routine) {
        var dk = util.addDays(today, parseInt(offset, 10));
        if (routine.days.indexOf(util.weekdayIndex(dk)) === -1) return;
        seed(routine.id, dk, false);
      });
    });

    data.routineRecords = records;

    data.tasks = [
      { id: util.uid('tk'), title: 'Review project requirements', description: 'Read the spec and list open questions.', date: today, priority: 'high', completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('tk'), title: 'Finish the React dashboard mockup', description: '', date: today, priority: 'high', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('tk'), title: 'Solve 2 algorithm problems', description: 'Arrays / two pointers this week.', date: today, priority: 'medium', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('tk'), title: 'Tidy up the workspace', description: '', date: today, priority: 'low', completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('tk'), title: 'Run 30 minutes', description: 'Evening jog around the park.', date: util.addDays(today, -1), priority: 'medium', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('tk'), title: 'Write weekly summary', description: 'Summarise progress and plan next week.', date: tomorrow, priority: 'medium', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('tk'), title: 'Code review for the team', description: '', date: tomorrow, priority: 'high', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('tk'), title: 'Plan next sprint', description: 'Draft the backlog with estimations.', date: util.addDays(today, 3), priority: 'low', completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];

    data.achievements = [
      { id: util.uid('ac'), title: 'Solved a hard dynamic programming problem', description: 'Finally understood memoisation well enough to nail the 0/1 knapsack variant on the first try.', date: today, createdAt: new Date().toISOString() },
      { id: util.uid('ac'), title: 'Completed today\'s workout', description: 'Full upper body session, 45 minutes.', date: today, createdAt: new Date().toISOString() },
      { id: util.uid('ac'), title: 'Studied for two hours straight', description: 'No phone, no interruptions.', date: util.addDays(today, -1), createdAt: new Date().toISOString() },
      { id: util.uid('ac'), title: 'Shipped the landing page', description: 'Deployed and shared with the client.', date: util.addDays(today, -2), createdAt: new Date().toISOString() }
    ];

    data.notes = [
      { id: util.uid('nt'), title: 'Weekly focus', body: 'Ship the planner module, keep the routine streak alive, and read 30 pages every night.', pinned: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('nt'), title: 'Books to read', body: '1. Deep Work\n2. Atomic Habits\n3. The Pragmatic Programmer', pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: util.uid('nt'), title: 'Gym plan', body: 'Mon: Push\nWed: Pull\nFri: Legs\nSat: Cardio + core', pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];

    return data;
  }

  /* ------------------------------------------------------------------ *
   * Validation / normalisation
   * ------------------------------------------------------------------ */
  function str(v, fallback) { return typeof v === 'string' ? v : (fallback || ''); }
  function isoOrNull(v) { return typeof v === 'string' && !isNaN(new Date(v).getTime()) ? v : null; }
  function arr(v) { return Array.isArray(v) ? v : []; }

  var PRIORITIES = ['high', 'medium', 'low'];
  var STATES = ['done', 'missed'];

  function normTask(raw) {
    if (!raw || typeof raw !== 'object' || !str(raw.title).trim()) return null;
    var date = util.isValidKey(raw.date) ? raw.date : util.today();
    return {
      id: str(raw.id) || util.uid('tk'),
      title: str(raw.title).slice(0, 200),
      description: str(raw.description).slice(0, 2000),
      date: date,
      priority: PRIORITIES.indexOf(raw.priority) > -1 ? raw.priority : 'medium',
      completed: raw.completed === true,
      completedAt: isoOrNull(raw.completedAt),
      createdAt: isoOrNull(raw.createdAt) || new Date().toISOString(),
      updatedAt: isoOrNull(raw.updatedAt) || new Date().toISOString()
    };
  }

  function normRoutine(raw, index) {
    if (!raw || typeof raw !== 'object' || !str(raw.name).trim()) return null;
    var days = arr(raw.days)
      .map(function (d) { return parseInt(d, 10); })
      .filter(function (d) { return d >= 0 && d <= 6; });
    if (!days.length) days = [0, 1, 2, 3, 4, 5, 6];
    days = days.filter(function (d, i) { return days.indexOf(d) === i; }).sort(function (a, b) { return a - b; });
    return {
      id: str(raw.id) || util.uid('rt'),
      name: str(raw.name).slice(0, 80),
      days: days,
      order: typeof raw.order === 'number' ? raw.order : index,
      createdAt: isoOrNull(raw.createdAt) || new Date().toISOString()
    };
  }

  function normRecords(raw, routineIds) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    routineIds.forEach(function (id) {
      var days = raw[id];
      if (!days || typeof days !== 'object') return;
      var bucket = {};
      Object.keys(days).forEach(function (dayKey) {
        if (!util.isValidKey(dayKey)) return;
        var state = days[dayKey];
        if (STATES.indexOf(state) === -1) return;
        bucket[dayKey] = state;
      });
      if (Object.keys(bucket).length) out[id] = bucket;
    });
    return out;
  }

  function normAchievement(raw) {
    if (!raw || typeof raw !== 'object' || !str(raw.title).trim()) return null;
    return {
      id: str(raw.id) || util.uid('ac'),
      title: str(raw.title).slice(0, 160),
      description: str(raw.description).slice(0, 2000),
      date: util.isValidKey(raw.date) ? raw.date : util.today(),
      createdAt: isoOrNull(raw.createdAt) || new Date().toISOString()
    };
  }

  function normNote(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var title = str(raw.title).trim();
    var body = str(raw.body || raw.content);
    if (!title && !body) return null;
    return {
      id: str(raw.id) || util.uid('nt'),
      title: title.slice(0, 120) || 'Untitled note',
      body: body.slice(0, 8000),
      pinned: raw.pinned === true,
      createdAt: isoOrNull(raw.createdAt) || new Date().toISOString(),
      updatedAt: isoOrNull(raw.updatedAt) || isoOrNull(raw.createdAt) || new Date().toISOString()
    };
  }

  /** Validate + normalise an arbitrary object into a safe LifeOS data shape. */
  function normalise(raw) {
    var base = emptyData();
    if (!raw || typeof raw !== 'object') return base;

    var s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    base.settings.displayName = str(s.displayName, 'Friend').trim().slice(0, 40) || 'Friend';
    base.settings.theme = s.theme === 'light' ? 'light' : 'dark';
    base.settings.sidebarCollapsed = s.sidebarCollapsed === true;
    var n = s.notifications && typeof s.notifications === 'object' ? s.notifications : {};
    base.settings.notifications = {
      tasks: n.tasks === true,
      routine: n.routine === true,
      achievements: n.achievements !== false
    };

    base.tasks = arr(raw.tasks).map(normTask).filter(Boolean);

    base.routines = arr(raw.routines)
      .map(normRoutine)
      .filter(Boolean)
      .sort(function (a, b) { return a.order - b.order; })
      .map(function (r, i) { r.order = i; return r; });

    base.routineRecords = normRecords(raw.routineRecords, base.routines.map(function (r) { return r.id; }));
    base.achievements = arr(raw.achievements).map(normAchievement).filter(Boolean);
    base.notes = arr(raw.notes).map(normNote).filter(Boolean);

    base.meta = {
      createdAt: (raw.meta && isoOrNull(raw.meta.createdAt)) || new Date().toISOString(),
      demo: !!(raw.meta && raw.meta.demo)
    };

    return base;
  }

  /* ------------------------------------------------------------------ *
   * Store
   * ------------------------------------------------------------------ */
  var listeners = [];

  var Store = {
    data: emptyData(),
    util: util,
    DAY_LABELS: DAY_LABELS,
    DAY_FULL: DAY_FULL,
    PRIORITIES: PRIORITIES,
    STATES: STATES,

    /** Load from LocalStorage, seeding demo data on a truly empty install. */
    load: function () {
      var raw = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        console.warn('LifeOS: LocalStorage unavailable.', e);
      }

      if (!raw) {
        this.data = demoData();
        this.save(true);
        return this.data;
      }

      var parsed = null;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn('LifeOS: stored data was corrupted, starting clean.', e);
        try { localStorage.setItem(STORAGE_KEY + '.backup', raw); } catch (_) {}
        this.data = emptyData();
        this.save(true);
        return this.data;
      }

      this.data = normalise(parsed);
      return this.data;
    },

    /** Persist to LocalStorage and notify subscribers. */
    save: function (silent) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.error('LifeOS: could not save data.', e);
      }
      if (!silent) this.emit();
    },

    /** Mutate then persist: Store.update(function (data) { ... }) */
    update: function (fn, silent) {
      if (typeof fn === 'function') fn(this.data);
      this.save(silent);
    },

    emit: function () {
      listeners.forEach(function (fn) {
        try { fn(Store.data); } catch (e) { console.error(e); }
      });
    },

    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i > -1) listeners.splice(i, 1);
      };
    },

    /** Replace everything (import / reset / reload demo). */
    replace: function (raw, opts) {
      this.data = normalise(raw);
      this.save(!!(opts && opts.silent));
      return this.data;
    },

    reset: function () {
      this.data = emptyData();
      this.save();
    },

    loadDemo: function () {
      this.data = normalise(demoData());
      this.save();
    },

    exportJSON: function () {
      return JSON.stringify(this.data, null, 2);
    },

    /* -------------------------- Task helpers -------------------------- */
    tasksOn: function (key) {
      return this.data.tasks.filter(function (t) { return t.date === key; });
    },
    pendingOn: function (key) {
      return this.data.tasks.filter(function (t) { return t.date === key && !t.completed; });
    },
    completedOn: function (key) {
      return this.data.tasks.filter(function (t) { return t.date === key && t.completed; });
    },
    overdueTasks: function () {
      var today = util.today();
      return this.data.tasks.filter(function (t) { return !t.completed && t.date < today; });
    },
    upcomingTasks: function () {
      var today = util.today();
      return this.data.tasks
        .filter(function (t) { return !t.completed && t.date > today; })
        .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    },

    /* ------------------------ Routine helpers ------------------------- */
    routinesSorted: function () {
      return this.data.routines.slice().sort(function (a, b) { return a.order - b.order; });
    },
    routinesForDay: function (key) {
      var wd = util.weekdayIndex(key);
      return this.routinesSorted().filter(function (r) { return r.days.indexOf(wd) > -1; });
    },
    getState: function (routineId, key) {
      var bucket = this.data.routineRecords[routineId];
      return bucket && bucket[key] ? bucket[key] : null;
    },
    setState: function (routineId, key, state) {
      if (STATES.indexOf(state) === -1) state = null;
      this.update(function (data) {
        if (!data.routineRecords[routineId]) data.routineRecords[routineId] = {};
        var bucket = data.routineRecords[routineId];
        if (state === null) {
          delete bucket[key];
          if (!Object.keys(bucket).length) delete data.routineRecords[routineId];
        } else {
          bucket[key] = state;
        }
      });
    },
    /** Cycle neutral -> done -> missed -> neutral */
    cycleState: function (routineId, key) {
      var current = this.getState(routineId, key);
      var next = current === 'done' ? 'missed' : current === 'missed' ? null : 'done';
      this.setState(routineId, key, next);
      return next;
    },
    /** Counts over a set of day keys, only for days the routine is scheduled. */
    routineCounts: function (routineId, dayKeys) {
      var routine = this.data.routines.find(function (r) { return r.id === routineId; });
      if (!routine) return { done: 0, missed: 0, scheduled: 0, tracked: 0 };
      var done = 0, missed = 0, scheduled = 0;
      dayKeys.forEach(function (key) {
        if (routine.days.indexOf(util.weekdayIndex(key)) === -1) return;
        scheduled++;
        var state = Store.getState(routineId, key);
        if (state === 'done') done++;
        else if (state === 'missed') missed++;
      });
      return { done: done, missed: missed, scheduled: scheduled, tracked: done + missed };
    },
    /** Aggregate counts across routines for a set of day keys. */
    rangeTotals: function (dayKeys) {
      var done = 0, missed = 0, scheduled = 0;
      this.data.routines.forEach(function (routine) {
        var c = Store.routineCounts(routine.id, dayKeys);
        done += c.done; missed += c.missed; scheduled += c.scheduled;
      });
      return { done: done, missed: missed, scheduled: scheduled, tracked: done + missed };
    },

    /* ------------------------ Notes / achievements -------------------- */
    achievementsOn: function (key) {
      return this.data.achievements.filter(function (a) { return a.date === key; });
    },
    notesSorted: function () {
      return this.data.notes.slice().sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
    },
    counts: function () {
      var d = this.data;
      return {
        tasks: d.tasks.length,
        routines: d.routines.length,
        achievements: d.achievements.length,
        notes: d.notes.length
      };
    }
  };

  App.util = util;
  App.Store = Store;

})(window.LifeOS);

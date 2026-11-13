# LifeOS — Personal Daily Planner

A premium, macOS-inspired personal productivity app built with plain HTML5, CSS3 and vanilla
JavaScript. Everything runs in the browser and every change is saved to LocalStorage
automatically.

Open `index.html` in a browser to use it. No build step, no dependencies to install.

---

## Features

| Section | What it does |
|---|---|
| **Dashboard** | Time-based greeting, live clock, today's task overview, completed/pending counts, routine completion %, today's achievements, upcoming tasks and a quick-add button. |
| **To-Do List** | Add, edit, delete and complete tasks. Date, priority (High/Medium/Low), optional description, search, filters (all/pending/completed/overdue), overdue highlighting and moving unfinished tasks to another date. |
| **Daily Planner** | Plan today, tomorrow or any future date. Pending and completed lists side by side, daily progress bar, and a one-click "move unfinished to next day" action. |
| **Routine Tracker** | The core feature. Add your own activities, choose which weekdays to track, and mark each day as **Completed ✓**, **Missed ✕** or **Not marked –**. Day, Week and Month views, drag-to-reorder, per-period statistics and a completion chart. |
| **My Achievements** | Record what you accomplished each day with a title, description and date. Browse today's wins, this week's, or the full history grouped by date. |
| **Quick Notes** | Minimal notes with pinning, search, edit, delete and a "last updated" timestamp. |
| **Settings** | Display name, theme selection, notification preferences, JSON export/import, demo data reload and a full data reset. |

### Routine tracking rules

* Unmarked days stay neutral — the app **never** marks an activity as missed for you.
* Only days an activity is actually scheduled for count towards consistency.
* Every status is written to LocalStorage the moment you set it, and past entries stay
  editable so you can correct mistakes.

---

## Project structure

```
LifeOS/
├── index.html            App shell: sidebar, topbar, all page containers
├── css/
│   ├── style.css         Design tokens, layout shell, typography
│   ├── components.css    Buttons, inputs, modals, cards, tracker grid, notes
│   └── responsive.css    Tablet and mobile adaptations
├── js/
│   ├── storage.js        Data model, LocalStorage persistence, validation, helpers
│   ├── app.js            Navigation, theme, sidebar, modals, toasts, bootstrap
│   ├── dashboard.js      Dashboard page
│   ├── tasks.js          To-do list + task form modal
│   ├── planner.js        Daily planner
│   ├── routine.js        Routine tracker (day / week / month) + activity manager
│   ├── achievements.js   Achievements page
│   ├── notes.js          Quick notes page
│   └── settings.js       Settings, export / import / reset
├── assets/
│   └── favicon.svg       App icon
└── README.md
```

Each page module registers itself on `window.LifeOS.pages`, so adding a section means adding
one file and one `<section class="page">` block.

---

## Tech

* **HTML5 / CSS3 / Vanilla JavaScript ES6** — no frameworks, no bundler.
* **[Lucide](https://lucide.dev)** icons (CDN).
* **[Chart.js](https://www.chartjs.org)** for the routine completion charts (CDN).
* **LocalStorage** for persistence, with input validation and corruption recovery.

The two CDN scripts are the only external requests. If you need the app fully offline, download
both files into `assets/` and update the two `<script src>` tags in `index.html`.

---

## Design

Apple macOS-inspired interface with an elegant dark theme by default.

* Frosted-glass translucent panels via `backdrop-filter` with layered surfaces for readability.
* Soft shadows, thin transparent borders, generous rounded corners, spacious layout.
* Smooth, fast transitions; fully functional light theme.
* Responsive: floating desktop layout, adaptive tablet layout, slide-out drawer and large tap
  targets on mobile.

### Theme

The theme is applied by an inline script in `<head>` before the first paint, so there is no
flash of the wrong theme on load. The choice is stored in LocalStorage and re-applied to every
page, modal, form and chart.

Colour tokens live at the top of [style.css](css/style.css) — change them there to restyle the
whole app.

---

## Data & privacy

All data lives in **this browser on this device** under the LocalStorage key `lifeos.data.v1`.
There is no server and no cloud synchronisation. Clearing your browser data will erase it, so
use **Settings → Export JSON** for backups, and **Import JSON** to restore one.

On first launch the app seeds realistic demo data so every screen has something to show. Use
**Settings → Reload demo data** or **Reset all data** to clear it.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Shift` + `N` | New task |
| `Esc` | Close the open dialog, menu or mobile drawer |

---

## Browser support

Chrome, Edge, Safari and Firefox (current versions). `backdrop-filter` is required for the
frosted-glass effect; on browsers without it the app still works, with solid panels instead.

/* ==========================================================================
   LifeOS — notes.js
   Quick Notes: minimal notes with pinning, search and autosave.
   ========================================================================== */

(function (App) {
  'use strict';

  App.pages = App.pages || {};
  App.forms = App.forms || {};

  var util = App.util;
  var Store = App.Store;

  var state = { search: '' };

  /* ------------------------------------------------------------------ *
   * Form
   * ------------------------------------------------------------------ */
  function openNoteForm(existing) {
    var body = '' +
      '<div class="field">' +
        '<label for="nfTitle">Title</label>' +
        '<input class="input" id="nfTitle" type="text" maxlength="120" placeholder="Note title" value="' +
          util.escape(existing ? existing.title : '') + '" />' +
      '</div>' +
      '<div class="field">' +
        '<label for="nfBody">Note</label>' +
        '<textarea class="input" id="nfBody" maxlength="8000" style="min-height:170px" placeholder="Write anything...">' +
          util.escape(existing ? existing.body : '') + '</textarea>' +
      '</div>' +
      '<div class="setting-row" style="border:none;padding-top:0">' +
        '<div><strong>Pin this note</strong><span class="hint">Pinned notes stay at the top</span></div>' +
        '<label class="switch"><input type="checkbox" id="nfPin"' + (existing && existing.pinned ? ' checked' : '') + ' /><span></span></label>' +
      '</div>';

    App.ui.modal({
      title: existing ? 'Edit note' : 'New note',
      body: body,
      footer: '<button class="btn btn-ghost" data-close>Cancel</button>' +
              '<button class="btn btn-primary" id="nfSave"><i data-lucide="check"></i>' +
              (existing ? 'Save changes' : 'Add note') + '</button>',
      onMount: function (root, close) {
        var titleEl = root.querySelector('#nfTitle');
        var bodyEl = root.querySelector('#nfBody');
        setTimeout(function () { titleEl.focus(); }, 60);

        function submit() {
          var title = titleEl.value.trim();
          var text = bodyEl.value.trim();
          if (!title && !text) {
            App.ui.toast('Write something before saving.', 'error');
            return;
          }
          var pinned = root.querySelector('#nfPin').checked;

          Store.update(function (data) {
            if (existing) {
              var n = data.notes.find(function (x) { return x.id === existing.id; });
              if (n) {
                n.title = title || 'Untitled note';
                n.body = text;
                n.pinned = pinned;
                n.updatedAt = new Date().toISOString();
              }
            } else {
              data.notes.push({
                id: util.uid('nt'),
                title: title || 'Untitled note',
                body: text,
                pinned: pinned,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          });

          App.ui.toast(existing ? 'Note updated.' : 'Note saved.', 'success');
          close();
        }

        root.querySelector('#nfSave').addEventListener('click', submit);
        titleEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); bodyEl.focus(); }
        });
      }
    });
  }

  function togglePin(id) {
    Store.update(function (data) {
      var n = data.notes.find(function (x) { return x.id === id; });
      if (!n) return;
      n.pinned = !n.pinned;
      n.updatedAt = new Date().toISOString();
    });
    var note = Store.data.notes.find(function (x) { return x.id === id; });
    App.ui.toast(note && note.pinned ? 'Note pinned.' : 'Note unpinned.', 'info');
  }

  function deleteNote(id) {
    var n = Store.data.notes.find(function (x) { return x.id === id; });
    if (!n) return;
    App.ui.confirm({
      title: 'Delete note?',
      message: '"' + n.title + '" will be removed permanently.',
      confirmText: 'Delete'
    }).then(function (ok) {
      if (!ok) return;
      Store.update(function (data) {
        data.notes = data.notes.filter(function (x) { return x.id !== id; });
      });
      App.ui.toast('Note deleted.', 'info');
    });
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */
  function filtered() {
    var list = Store.notesSorted();
    if (!state.search) return list;
    var q = state.search.toLowerCase();
    return list.filter(function (n) {
      return (n.title + ' ' + n.body).toLowerCase().indexOf(q) > -1;
    });
  }

  function noteCard(n) {
    return '' +
      '<article class="note-card' + (n.pinned ? ' is-pinned' : '') + '" data-note-open="' + n.id + '">' +
        '<div class="note-head">' +
          '<h3 class="note-title">' + util.escape(n.title) + '</h3>' +
          (n.pinned ? '<span class="pin-mark" title="Pinned"><i data-lucide="pin"></i></span>' : '') +
        '</div>' +
        (n.body ? '<p class="note-body">' + util.escape(n.body) + '</p>' : '<p class="note-body muted">Empty note</p>') +
        '<div class="note-foot">' +
          '<span>Updated ' + util.relativeTime(n.updatedAt) + '</span>' +
          '<span class="note-foot-actions">' +
            '<button class="tiny-btn" data-note-pin="' + n.id + '" title="' + (n.pinned ? 'Unpin' : 'Pin') + '">' +
              '<i data-lucide="' + (n.pinned ? 'pin-off' : 'pin') + '"></i></button>' +
            '<button class="tiny-btn" data-note-edit="' + n.id + '" title="Edit"><i data-lucide="pencil"></i></button>' +
            '<button class="tiny-btn danger" data-note-del="' + n.id + '" title="Delete"><i data-lucide="trash-2"></i></button>' +
          '</span>' +
        '</div>' +
      '</article>';
  }

  var Notes = {
    render: function () {
      var grid = document.getElementById('notesGrid');
      if (!grid) return;

      var list = filtered();

      if (!list.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><i data-lucide="sticky-note"></i><strong>' +
          (state.search ? 'No notes found' : 'No notes yet') + '</strong><p>' +
          (state.search ? 'Try a different search term.' : 'Keep reminders, ideas and lists in one place.') +
          '</p></div>';
        App.ui.icons();
        return;
      }

      grid.innerHTML = list.map(noteCard).join('');
      App.ui.icons();
    }
  };

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  function bind() {
    var search = document.getElementById('noteSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value.trim();
        Notes.render();
      });
    }

    var grid = document.getElementById('notesGrid');
    if (grid) {
      grid.addEventListener('click', function (e) {
        var btn;
        if ((btn = e.target.closest('[data-note-pin]'))) { e.stopPropagation(); togglePin(btn.getAttribute('data-note-pin')); return; }
        if ((btn = e.target.closest('[data-note-edit]'))) { e.stopPropagation(); openNote(btn.getAttribute('data-note-edit')); return; }
        if ((btn = e.target.closest('[data-note-del]'))) { e.stopPropagation(); deleteNote(btn.getAttribute('data-note-del')); return; }
        var cardEl = e.target.closest('[data-note-open]');
        if (cardEl) openNote(cardEl.getAttribute('data-note-open'));
      });
    }
  }

  function openNote(id) {
    var n = Store.data.notes.find(function (x) { return x.id === id; });
    if (n) openNoteForm(n);
  }

  App.pages.notes = Notes;
  App.forms.note = openNoteForm;

  document.addEventListener('DOMContentLoaded', bind);

})(window.LifeOS);

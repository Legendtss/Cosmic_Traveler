/**
 * ============================================================================
 * features/notes/notes.service.js — Notes Data & Mutations
 * ============================================================================
 *
 * Owns Notes state and API calls.
 * Exposed on window.NotesService.
 */

var _notes = window._notes || {
  items: [],
  filter: 'all',
  searchQuery: '',
  editingNoteId: null,
  viewingNote: null,
  searchTimer: null,
};

(function () {
  'use strict';

  window._notes = _notes;

  function _sync() {
    if (typeof syncToAppState === 'function') {
      syncToAppState('notes');
    }
  }

  async function _apiFetch(url, opts) {
    try {
      var res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
      if (!res.ok) throw new Error('HTTP ' + res.status);

      var text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (err) {
      console.error('[Notes]', err);
      return null;
    }
  }

  function _buildCollectionUrl() {
    var params = new URLSearchParams();
    if (_notes.filter && _notes.filter !== 'all') {
      params.set('source_type', _notes.filter);
    }
    if (_notes.searchQuery) {
      params.set('search', _notes.searchQuery);
    }
    return '/api/notes' + (params.toString() ? '?' + params.toString() : '');
  }

  window.NotesService = {
    getState: function () {
      return _notes;
    },

    apiFetch: _apiFetch,

    reload: async function () {
      var data = await _apiFetch(_buildCollectionUrl());
      if (Array.isArray(data)) {
        _notes.items = data;
      }
      _sync();
      return _notes.items.slice();
    },

    setFilter: function (filter) {
      _notes.filter = filter === 'manual' || filter === 'task' ? filter : 'all';
    },

    setSearchQuery: function (query) {
      _notes.searchQuery = String(query || '').trim();
    },

    beginCreate: function () {
      _notes.editingNoteId = null;
    },

    beginEdit: function (note) {
      if (!note || !note.id) return null;
      _notes.editingNoteId = Number(note.id);
      return note;
    },

    cancelEdit: function () {
      _notes.editingNoteId = null;
    },

    saveNote: async function (payload) {
      var body = {
        title: String(payload && payload.title || '').trim(),
        content: String(payload && payload.content || '').trim(),
        tags: Array.isArray(payload && payload.tags) ? payload.tags : [],
      };

      if (!body.title) return null;

      var result = null;
      if (_notes.editingNoteId) {
        result = await _apiFetch('/api/notes/' + _notes.editingNoteId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        body.source_type = 'manual';
        result = await _apiFetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!result) return null;

      _notes.editingNoteId = null;
      await this.reload();
      return result;
    },

    fetchNoteDetail: async function (noteId) {
      var note = await _apiFetch('/api/notes/' + Number(noteId));
      if (note) {
        _notes.viewingNote = note;
      }
      return note;
    },

    clearViewingNote: function () {
      _notes.viewingNote = null;
    },

    deleteViewingNote: async function () {
      if (!_notes.viewingNote || !_notes.viewingNote.id) return false;

      var result = await _apiFetch('/api/notes/' + _notes.viewingNote.id, {
        method: 'DELETE',
      });
      if (!result) return false;

      _notes.viewingNote = null;
      await this.reload();
      return true;
    },

    beginEditViewingNote: function () {
      if (!_notes.viewingNote) return null;
      _notes.editingNoteId = Number(_notes.viewingNote.id);
      return Object.assign({}, _notes.viewingNote);
    },

    fetchLinkedTaskNote: async function (taskId) {
      return _apiFetch('/api/notes/from-task/' + Number(taskId));
    }
  };

  window.notesApiFetch = function notesApiFetch(url, opts) {
    return window.NotesService.apiFetch(url, opts);
  };

  window.loadNotes = function loadNotes() {
    return window.NotesService.reload();
  };
})();

/**
 * ============================================================================
 * features/notes/notes.selectors.js — Read-Only Notes Queries
 * ============================================================================
 *
 * Pure read-only functions for notes state.
 * Reads from AppState when hydrated, falls back to _notes global.
 *
 * Exposed on window.NotesSelectors.
 */
(function () {
  'use strict';

  function _getState() {
    if (window.NotesService && typeof window.NotesService.getState === 'function') {
      return window.NotesService.getState();
    }
    return window._notes || { items: [] };
  }

  function _getItems() {
    if (typeof AppState !== 'undefined' && Array.isArray(AppState.notes) && AppState.hydrated) {
      return AppState.notes;
    }
    return _getState().items || [];
  }

  window.NotesSelectors = {

    getAll: function () { return _getItems().slice(); },

    getById: function (noteId) {
      var id = Number(noteId);
      return _getItems().find(function (note) { return note.id === id; }) || null;
    },

    /**
     * Filter notes by search term and/or tag.
     * @param {Object} opts — { search, tag, filter }
     * @returns {Array}
     */
    getFiltered: function (opts) {
      opts = opts || {};
      var items = _getItems();
      if (opts.filter && opts.filter !== 'all') {
        items = items.filter(function (note) { return note.source_type === opts.filter; });
      }
      if (opts.tag) {
        items = items.filter(function (n) { return (n.tags || []).indexOf(opts.tag) >= 0; });
      }
      if (opts.search) {
        var q = opts.search.toLowerCase();
        items = items.filter(function (n) {
          return (n.title || '').toLowerCase().indexOf(q) >= 0 ||
                 (n.content || '').toLowerCase().indexOf(q) >= 0;
        });
      }
      return items;
    },

    /**
     * Count of all notes.
     * @returns {number}
     */
    getCount: function () {
      return _getItems().length;
    },

    getState: function () {
      return _getState();
    }
  };

})();

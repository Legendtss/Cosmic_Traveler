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

  function _notes() {
    if (typeof AppState !== 'undefined' && AppState.notes && AppState.notes.length) {
      return AppState.notes;
    }
    if (typeof _notes !== 'undefined' && _notes.items) return _notes.items;
    return [];
  }

  window.NotesSelectors = {

    getAll: function () { return _notes().slice(); },

    getById: function (noteId) {
      var id = Number(noteId);
      return _notes().find(function (n) { return n.id === id; }) || null;
    },

    /**
     * Filter notes by search term and/or tag.
     * @param {Object} opts — { search, tag, filter }
     * @returns {Array}
     */
    getFiltered: function (opts) {
      opts = opts || {};
      var items = _notes();
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
      return _notes().length;
    }
  };

})();

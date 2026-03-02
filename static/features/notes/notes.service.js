/**
 * ============================================================================
 * features/notes/notes.service.js — Notes Mutations
 * ============================================================================
 *
 * Write-side operations for notes.
 * Delegates to existing globals.
 *
 * Exposed on window.NotesService.
 */
(function () {
  'use strict';

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('notes');
  }

  window.NotesService = {

    /**
     * Reload notes from API/store.
     */
    reload: async function () {
      if (typeof loadNotes === 'function') await loadNotes();
      _sync();
    },

    /**
     * Create or update a note via the form submit handler.
     * @param {Event} e — form submit event
     */
    handleFormSubmit: async function (e) {
      if (typeof handleNoteFormSubmit === 'function') await handleNoteFormSubmit(e);
      _sync();
    },

    /**
     * Delete a note by ID.
     */
    deleteNote: async function () {
      if (typeof deleteCurrentNote === 'function') await deleteCurrentNote();
      _sync();
    },

    /**
     * Set the notes filter category.
     * @param {string} filter
     */
    setFilter: function (filter) {
      if (typeof setNotesFilter === 'function') setNotesFilter(filter);
    }
  };

})();

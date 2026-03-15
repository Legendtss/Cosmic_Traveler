/**
 * ============================================================================
 * features/notes/notes.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and NotesService / NotesSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.NotesController.
 *
 * Loaded AFTER notes.selectors.js, notes.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.NotesController = {

    // ── Write Operations ──────────────────────────────────────

    onReload: async function () {
      await window.NotesService.reload();
    },

    onPageShown: async function () {
      await window.NotesService.reload();
    },

    onSaveNote: async function (payload) {
      return window.NotesService.saveNote(payload);
    },

    onDeleteViewingNote: async function () {
      return window.NotesService.deleteViewingNote();
    },

    onSetFilter: function (filter) {
      window.NotesService.setFilter(filter);
      return window.NotesService.reload();
    },

    onSearchQueryChange: function (query) {
      window.NotesService.setSearchQuery(query);
      return window.NotesService.reload();
    },

    onBeginCreate: function () {
      window.NotesService.beginCreate();
    },

    onBeginEdit: function (note) {
      return window.NotesService.beginEdit(note);
    },

    onCancelEdit: function () {
      window.NotesService.cancelEdit();
    },

    onFetchDetail: async function (noteId) {
      return window.NotesService.fetchNoteDetail(noteId);
    },

    onClearViewingNote: function () {
      window.NotesService.clearViewingNote();
    },

    onEditViewingNote: function () {
      return window.NotesService.beginEditViewingNote();
    },

    onFetchLinkedTaskNote: async function (taskId) {
      return window.NotesService.fetchLinkedTaskNote(taskId);
    },

    init: function () {
      if (window.NotesView && typeof window.NotesView.init === 'function') {
        window.NotesView.init();
      }
    },

    render: function () {
      if (window.NotesView && typeof window.NotesView.render === 'function') {
        window.NotesView.render();
      }
    },

    // ── Read Operations ───────────────────────────────────────

    getState:   function ()     { return window.NotesSelectors.getState(); },
    getAll:     function ()     { return window.NotesSelectors.getAll(); },
    getById:    function (id)   { return window.NotesSelectors.getById(id); },
    getFiltered: function (opts) { return window.NotesSelectors.getFiltered(opts); },
    getCount:   function ()     { return window.NotesSelectors.getCount(); }
  };

})();

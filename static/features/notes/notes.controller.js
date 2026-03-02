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

    onFormSubmit: async function (e) {
      await window.NotesService.handleFormSubmit(e);
    },

    onDeleteNote: async function () {
      await window.NotesService.deleteNote();
    },

    onSetFilter: function (filter) {
      window.NotesService.setFilter(filter);
    },

    // ── Read Operations ───────────────────────────────────────

    getAll:     function ()     { return window.NotesSelectors.getAll(); },
    getById:    function (id)   { return window.NotesSelectors.getById(id); },
    getFiltered: function (opts) { return window.NotesSelectors.getFiltered(opts); },
    getCount:   function ()     { return window.NotesSelectors.getCount(); }
  };

})();

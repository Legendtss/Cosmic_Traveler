/**
 * ============================================================================
 * features/calendar/calendar.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and CalendarService / CalendarSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.CalendarController.
 *
 * Loaded AFTER calendar.selectors.js, calendar.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.CalendarController = {

    // ── Write Operations ──────────────────────────────────────

    onToggleImportantDate: function (dateKey) {
      window.CalendarService.toggleImportantDate(dateKey);
    },

    onRescheduleTask: async function (taskId, newDateKey) {
      await window.CalendarService.rescheduleTask(taskId, newDateKey);
    },

    onSetViewMode: function (mode) {
      window.CalendarService.setViewMode(mode);
    },

    // ── Read Operations ───────────────────────────────────────

    getTasksForDate: function (dateKey) {
      return window.CalendarSelectors.getTasksForDate(dateKey);
    },

    getOverdueTasks: function () {
      return window.CalendarSelectors.getOverdueTasks();
    },

    getImportantDates: function () {
      return window.CalendarSelectors.getImportantDates();
    },

    getViewMode: function () {
      return window.CalendarSelectors.getViewMode();
    }
  };

})();

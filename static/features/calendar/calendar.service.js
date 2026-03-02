/**
 * ============================================================================
 * features/calendar/calendar.service.js — Calendar Mutations
 * ============================================================================
 *
 * Write-side operations for the calendar. Delegates to existing globals.
 *
 * Exposed on window.CalendarService.
 */
(function () {
  'use strict';

  window.CalendarService = {

    /**
     * Toggle a date as important/pinned.
     * @param {string} dateKey — YYYY-MM-DD
     */
    toggleImportantDate: function (dateKey) {
      if (typeof calendarState !== 'undefined' && calendarState.importantDates) {
        if (calendarState.importantDates.has(dateKey)) {
          calendarState.importantDates.delete(dateKey);
        } else {
          calendarState.importantDates.add(dateKey);
        }
        if (typeof persistCalendarImportantDates === 'function') persistCalendarImportantDates();
        if (typeof syncToAppState === 'function') syncToAppState('calendar');
      }
    },

    /**
     * Reschedule a task to a different date via drag-and-drop.
     * @param {number|string} taskId
     * @param {string} newDateKey — YYYY-MM-DD
     */
    rescheduleTask: async function (taskId, newDateKey) {
      if (typeof calendarRescheduleTask === 'function') {
        await calendarRescheduleTask(taskId, newDateKey);
      }
    },

    /**
     * Switch between month and week view.
     * @param {string} mode — 'month'|'week'
     */
    setViewMode: function (mode) {
      if (typeof persistCalendarViewMode === 'function') persistCalendarViewMode(mode);
    }
  };

})();

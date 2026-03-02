/**
 * ============================================================================
 * features/calendar/calendar.selectors.js — Read-Only Calendar Queries
 * ============================================================================
 *
 * Pure read-only functions for calendar state queries.
 * Delegates date/task helpers to existing globals.
 *
 * Exposed on window.CalendarSelectors.
 */
(function () {
  'use strict';

  function _todayKey() {
    if (typeof toLocalDateKey === 'function') return toLocalDateKey(new Date());
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  window.CalendarSelectors = {

    /**
     * Tasks for a specific date (including recurring occurrences).
     * @param {string} dateKey — YYYY-MM-DD
     * @returns {Array}
     */
    getTasksForDate: function (dateKey) {
      if (typeof calendarTasksForDate === 'function') return calendarTasksForDate(dateKey);
      if (typeof TasksSelectors !== 'undefined') {
        return TasksSelectors.getAllTasks().filter(function (t) {
          if (typeof taskOccursOnDate === 'function') return taskOccursOnDate(t, dateKey);
          return false;
        });
      }
      return [];
    },

    /**
     * Overdue tasks as of today.
     * @returns {Array}
     */
    getOverdueTasks: function () {
      if (typeof calendarOverdueTasks === 'function') return calendarOverdueTasks();
      if (typeof TasksSelectors !== 'undefined') return TasksSelectors.getOverdueTasks();
      return [];
    },

    /**
     * Important/pinned dates set.
     * @returns {Set|Array}
     */
    getImportantDates: function () {
      if (typeof calendarState !== 'undefined' && calendarState.importantDates) {
        return calendarState.importantDates;
      }
      return new Set();
    },

    /**
     * Current calendar view mode (month/week).
     * @returns {string}
     */
    getViewMode: function () {
      if (typeof loadCalendarViewMode === 'function') return loadCalendarViewMode();
      return 'month';
    }
  };

})();

/**
 * ============================================================================
 * features/focus/focus.selectors.js — Read-Only Focus Queries
 * ============================================================================
 *
 * Pure read-only functions for focus/pomodoro state.
 * Reads from AppState and _focus global.
 *
 * Exposed on window.FocusSelectors.
 */
(function () {
  'use strict';

  function _sessions() {
    if (typeof AppState !== 'undefined' && AppState.focusSessions && AppState.focusSessions.length) {
      return AppState.focusSessions;
    }
    if (typeof _focus !== 'undefined') return _focus.sessions || [];
    return [];
  }

  window.FocusSelectors = {

    getAllSessions: function () { return _sessions().slice(); },

    /**
     * Total focus minutes logged today.
     * @returns {number}
     */
    getTodayMinutes: function () {
      var today = new Date().toISOString().slice(0, 10);
      return _sessions()
        .filter(function (s) { return (s.date || '').startsWith(today); })
        .reduce(function (sum, s) { return sum + (s.duration || 0); }, 0);
    },

    /**
     * Total sessions count.
     * @returns {number}
     */
    getSessionCount: function () {
      return _sessions().length;
    }
  };

})();

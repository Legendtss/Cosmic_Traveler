/**
 * ============================================================================
 * features/streaks/streaks.selectors.js — Read-Only Streaks Queries
 * ============================================================================
 *
 * Pure read-only functions for streak/points/level data.
 * Reads from AppState.streaks (authoritative source after hydration).
 *
 * Exposed on window.StreaksSelectors.
 */
(function () {
  'use strict';

  function _streaks() {
    if (typeof AppState !== 'undefined' && AppState.streaks) return AppState.streaks;
    return { currentStreak: 0, longestStreak: 0, totalPoints: 0, level: 1, xpIntoLevel: 0, xpNeeded: 200 };
  }

  window.StreaksSelectors = {

    getCurrent: function ()       { return _streaks(); },
    getCurrentStreak: function () { return _streaks().currentStreak; },
    getLongestStreak: function ()  { return _streaks().longestStreak; },
    getTotalPoints: function ()   { return _streaks().totalPoints; },
    getLevel: function ()         { return _streaks().level; },

    /**
     * XP progress within the current level.
     * @returns {{ xpIntoLevel: number, xpNeeded: number, percent: number }}
     */
    getLevelProgress: function () {
      var s = _streaks();
      var pct = s.xpNeeded > 0 ? Math.min(100, Math.round((s.xpIntoLevel / s.xpNeeded) * 100)) : 0;
      return { xpIntoLevel: s.xpIntoLevel, xpNeeded: s.xpNeeded, percent: pct };
    },

    /**
     * Cached streak evaluation from localStorage.
     * @returns {Object|null}
     */
    getCachedEval: function () {
      if (typeof loadStreakCache === 'function') return loadStreakCache();
      return null;
    }
  };

})();

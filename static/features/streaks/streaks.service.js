/**
 * ============================================================================
 * features/streaks/streaks.service.js — Streaks Mutations
 * ============================================================================
 *
 * Write-side operations for streaks & points.
 * Delegates to existing globals.
 *
 * Exposed on window.StreaksService.
 */
(function () {
  'use strict';

  var _lastEvalTs = 0;
  var COOLDOWN_MS = 2000;

  window.StreaksService = {

    /**
     * Evaluate today's streak & points (with cooldown guard).
     * @returns {Promise<Object|null>}
     */
    evaluate: async function () {
      var now = Date.now();
      if ((now - _lastEvalTs) < COOLDOWN_MS) return null;
      _lastEvalTs = now;

      if (typeof evaluateStreaksAndPoints === 'function') {
        var result = await evaluateStreaksAndPoints();
        if (result && typeof syncStreakResult === 'function') {
          syncStreakResult(result);
        }
        return result;
      }
      return null;
    },

    /**
     * Force a full UI refresh of the streaks panel.
     */
    refreshUI: function () {
      if (typeof refreshStreaksAfterChange === 'function') refreshStreaksAfterChange();
    }
  };

})();

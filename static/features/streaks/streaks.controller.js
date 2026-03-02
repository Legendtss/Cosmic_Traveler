/**
 * ============================================================================
 * features/streaks/streaks.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and StreaksService / StreaksSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.StreaksController.
 *
 * Loaded AFTER streaks.selectors.js, streaks.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.StreaksController = {

    // ── Write Operations ──────────────────────────────────────

    onEvaluate: async function () {
      return await window.StreaksService.evaluate();
    },

    onRefreshUI: function () {
      window.StreaksService.refreshUI();
    },

    // ── Read Operations ───────────────────────────────────────

    getCurrent:       function () { return window.StreaksSelectors.getCurrent(); },
    getCurrentStreak: function () { return window.StreaksSelectors.getCurrentStreak(); },
    getLongestStreak:  function () { return window.StreaksSelectors.getLongestStreak(); },
    getTotalPoints:   function () { return window.StreaksSelectors.getTotalPoints(); },
    getLevel:         function () { return window.StreaksSelectors.getLevel(); },
    getLevelProgress:  function () { return window.StreaksSelectors.getLevelProgress(); },
    getCachedEval:    function () { return window.StreaksSelectors.getCachedEval(); }
  };

})();

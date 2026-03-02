/**
 * ============================================================================
 * features/statistics/statistics.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and StatisticsService / StatisticsSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.StatisticsController.
 *
 * Loaded AFTER statistics.selectors.js, statistics.service.js, and state/,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.StatisticsController = {

    // ── Write Operations ──────────────────────────────────────

    onRefresh: function () {
      window.StatisticsService.refresh();
    },

    onRender: function () {
      window.StatisticsService.render();
    },

    // ── Read Operations ───────────────────────────────────────

    getEnabledModules: function () {
      return window.StatisticsSelectors.getEnabledModules();
    },

    getSummaryCards: function () {
      return window.StatisticsSelectors.getSummaryCards();
    }
  };

})();

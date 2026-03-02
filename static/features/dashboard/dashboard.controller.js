/**
 * ============================================================================
 * features/dashboard/dashboard.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and DashboardService / DashboardSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.DashboardController.
 *
 * Loaded AFTER dashboard.selectors.js, dashboard.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.DashboardController = {

    // ── Write Operations ──────────────────────────────────────

    onRefreshMetrics: function () {
      window.DashboardService.refreshMetrics();
    },

    onSaveQuickActions: function (actions) {
      window.DashboardService.saveQuickActions(actions);
    },

    onRunQuickAction: function (actionId) {
      window.DashboardService.runQuickAction(actionId);
    },

    onToggleTimer: function () {
      window.DashboardService.toggleTimer();
    },

    // ── Read Operations ───────────────────────────────────────

    getQuickActions: function () {
      return window.DashboardSelectors.getQuickActions();
    },

    getMetrics: function () {
      return window.DashboardSelectors.getMetrics();
    },

    isFeatureEnabled: function (featureName) {
      return window.DashboardSelectors.isFeatureEnabled(featureName);
    }
  };

})();

/**
 * ============================================================================
 * features/dashboard/dashboard.service.js — Dashboard Mutations
 * ============================================================================
 *
 * Write-side operations for the dashboard. Delegates to existing globals.
 *
 * Exposed on window.DashboardService.
 */
(function () {
  'use strict';

  window.DashboardService = {

    /**
     * Refresh all dashboard metric cards.
     */
    refreshMetrics: function () {
      if (typeof refreshDashboardMetrics === 'function') refreshDashboardMetrics();
    },

    /**
     * Persist quick-action configuration.
     * @param {Array} actions
     */
    saveQuickActions: function (actions) {
      if (typeof persistDashboardQuickActions === 'function') persistDashboardQuickActions(actions);
    },

    /**
     * Execute a quick-action by id.
     * @param {string} actionId
     */
    runQuickAction: function (actionId) {
      if (typeof runDashboardQuickAction === 'function') runDashboardQuickAction(actionId);
    },

    /**
     * Toggle the dashboard focus timer.
     */
    toggleTimer: function () {
      if (typeof toggleDashboardTimer === 'function') toggleDashboardTimer();
    }
  };

})();

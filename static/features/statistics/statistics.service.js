/**
 * ============================================================================
 * features/statistics/statistics.service.js — Statistics Mutations
 * ============================================================================
 *
 * Operations for recomputing and rendering statistics.
 * Delegates to existing globals.
 *
 * Exposed on window.StatisticsService.
 */
(function () {
  'use strict';

  window.StatisticsService = {

    /**
     * Refresh all statistics data for the active user.
     */
    refresh: function () {
      if (typeof updateStatisticsForActiveUser === 'function') updateStatisticsForActiveUser();
    },

    /**
     * Render the full statistics page.
     */
    render: function () {
      if (typeof renderStatistics === 'function') renderStatistics();
    }
  };

})();

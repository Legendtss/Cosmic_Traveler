/**
 * ============================================================================
 * features/statistics/statistics.selectors.js — Read-Only Stats Queries
 * ============================================================================
 *
 * Aggregates cross-domain data for the statistics page.
 * Delegates to domain Selectors and existing globals.
 *
 * Exposed on window.StatisticsSelectors.
 */
(function () {
  'use strict';

  window.StatisticsSelectors = {

    /**
     * Which statistics modules are enabled for the active user.
     * @returns {Array<string>}
     */
    getEnabledModules: function () {
      if (typeof getEnabledStatisticsModules === 'function') return getEnabledStatisticsModules();
      return ['tasks', 'nutrition', 'workouts', 'streaks'];
    },

    /**
     * Summary card data (count overviews).
     * @returns {Object}
     */
    getSummaryCards: function () {
      if (typeof statisticsSummaryCards === 'function') return statisticsSummaryCards();
      return {};
    }
  };

})();

/**
 * ============================================================================
 * features/dashboard/dashboard.selectors.js — Read-Only Dashboard Queries
 * ============================================================================
 *
 * Pure read-only functions that aggregate data for the dashboard view.
 * Delegates to other domain Selectors and existing globals.
 *
 * Exposed on window.DashboardSelectors.
 */
(function () {
  'use strict';

  window.DashboardSelectors = {

    /**
     * Quick-action configuration for the active user.
     * @returns {Array}
     */
    getQuickActions: function () {
      if (typeof loadDashboardQuickActions === 'function') return loadDashboardQuickActions();
      return [];
    },

    /**
     * Dashboard metrics snapshot (tasks, nutrition, workouts, streaks).
     * @returns {Object}
     */
    getMetrics: function () {
      var taskCounts = (typeof TasksSelectors !== 'undefined') ? TasksSelectors.getTaskCounts() : { total: 0, active: 0, completed: 0, overdue: 0 };
      var todayTotals = (typeof NutritionSelectors !== 'undefined') ? NutritionSelectors.getTodayTotals() : { calories: 0, protein: 0 };
      var workoutToday = (typeof WorkoutsSelectors !== 'undefined') ? WorkoutsSelectors.hasCompletedWorkoutToday() : false;
      var streaks = (typeof AppState !== 'undefined') ? AppState.streaks : { currentStreak: 0, level: 1 };

      return {
        tasks: taskCounts,
        nutrition: todayTotals,
        workoutCompletedToday: workoutToday,
        streak: streaks.currentStreak,
        level: streaks.level
      };
    },

    /**
     * Whether a specific feature module is enabled.
     * @param {string} featureName
     * @returns {boolean}
     */
    isFeatureEnabled: function (featureName) {
      if (typeof isFeatureEnabled === 'function') return isFeatureEnabled(featureName);
      return true;
    }
  };

})();

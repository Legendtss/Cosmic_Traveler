/**
 * ============================================================================
 * features/profile/profile.service.js — Profile Mutations
 * ============================================================================
 *
 * Write-side operations for profile/settings.
 * Delegates to existing globals.
 *
 * Exposed on window.ProfileService.
 */
(function () {
  'use strict';

  window.ProfileService = {

    /**
     * Persist the current profile state.
     */
    save: function () {
      if (typeof persistProfileState === 'function') persistProfileState();
      if (typeof syncToAppState === 'function') syncToAppState('profile');
    },

    /**
     * Apply a theme change.
     * @param {string} theme — 'light'|'dark'
     */
    setTheme: function (theme) {
      if (typeof applyTheme === 'function') applyTheme(theme);
      if (typeof syncToAppState === 'function') syncToAppState('profile');
    },

    /**
     * Sync nutrition goals derived from profile data.
     */
    syncNutritionGoals: function () {
      if (typeof syncNutritionGoalWithProfile === 'function') syncNutritionGoalWithProfile();
    }
  };

})();

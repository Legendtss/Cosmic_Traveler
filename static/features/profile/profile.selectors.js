/**
 * ============================================================================
 * features/profile/profile.selectors.js — Read-Only Profile Queries
 * ============================================================================
 *
 * Pure read-only functions for profile/settings data.
 * Reads from AppState when hydrated, falls back to profileState.
 *
 * Exposed on window.ProfileSelectors.
 */
(function () {
  'use strict';

  function _profile() {
    if (typeof AppState !== 'undefined' && AppState.profile) return AppState.profile;
    if (typeof profileState !== 'undefined') return profileState;
    return {};
  }

  window.ProfileSelectors = {

    getProfile: function () { return Object.assign({}, _profile()); },

    getTheme: function () {
      if (typeof AppState !== 'undefined') return AppState.theme || 'light';
      var p = _profile();
      return p.theme || 'light';
    },

    isComplete: function () {
      if (typeof isProfileCoreDataComplete === 'function') return isProfileCoreDataComplete();
      return false;
    },

    /**
     * Health metrics calculated from profile data.
     * @returns {Object}
     */
    getHealthMetrics: function () {
      if (typeof calculateProfileHealthMetrics === 'function') return calculateProfileHealthMetrics();
      return {};
    }
  };

})();

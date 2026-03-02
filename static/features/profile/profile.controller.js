/**
 * ============================================================================
 * features/profile/profile.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and ProfileService / ProfileSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.ProfileController.
 *
 * Loaded AFTER profile.selectors.js, profile.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.ProfileController = {

    // ── Write Operations ──────────────────────────────────────

    onSave: function () {
      window.ProfileService.save();
    },

    onSetTheme: function (theme) {
      window.ProfileService.setTheme(theme);
    },

    onSyncNutritionGoals: function () {
      window.ProfileService.syncNutritionGoals();
    },

    // ── Read Operations ───────────────────────────────────────

    getProfile: function () {
      return window.ProfileSelectors.getProfile();
    },

    getTheme: function () {
      return window.ProfileSelectors.getTheme();
    },

    isComplete: function () {
      return window.ProfileSelectors.isComplete();
    },

    getHealthMetrics: function () {
      return window.ProfileSelectors.getHealthMetrics();
    }
  };

})();

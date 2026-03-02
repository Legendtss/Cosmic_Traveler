/**
 * ============================================================================
 * features/workouts/workouts.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and WorkoutsService / WorkoutsSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Other modules (AI chat, calendar, dashboard, statistics) should prefer
 * calling WorkoutsController methods over directly calling script.js globals.
 *
 * Exposed on window.WorkoutsController.
 *
 * Loaded AFTER workouts.selectors.js, workouts.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.WorkoutsController = {

    // ── Write Operations (delegate to WorkoutsService) ────

    /**
     * Create a new workout.
     * @param {Object} payload — { name, type, intensity, duration, calories_burned, notes, exercises[] }
     * @returns {Object|null}
     */
    onCreateWorkout: async function onCreateWorkout(payload) {
      return await window.WorkoutsService.createWorkout(payload);
    },

    /**
     * Mark workout as completed.
     * @param {number|string} workoutId
     */
    onCompleteWorkout: async function onCompleteWorkout(workoutId) {
      await window.WorkoutsService.completeWorkout(workoutId);
    },

    /**
     * Skip a workout (reschedule to tomorrow).
     * @param {number|string} workoutId
     */
    onSkipWorkout: async function onSkipWorkout(workoutId) {
      await window.WorkoutsService.skipWorkout(workoutId);
    },

    /**
     * Update workout fields.
     * @param {number|string} id
     * @param {Object} payload
     * @returns {boolean}
     */
    onUpdateWorkout: async function onUpdateWorkout(id, payload) {
      return await window.WorkoutsService.updateWorkout(id, payload);
    },

    /**
     * Reload all workouts from source.
     */
    onReload: async function onReload() {
      await window.WorkoutsService.reload();
    },

    // ── Templates ─────────────────────────────────────────

    /**
     * Save a workout template.
     * @param {Object} template — { name, exercises[] }
     */
    onSaveTemplate: function onSaveTemplate(template) {
      window.WorkoutsService.saveTemplate(template);
    },

    /**
     * Delete a workout template.
     * @param {number|string} templateId
     */
    onDeleteTemplate: function onDeleteTemplate(templateId) {
      window.WorkoutsService.deleteTemplate(templateId);
    },

    /**
     * Load templates & meta from localStorage.
     */
    onLoadStorage: function onLoadStorage() {
      window.WorkoutsService.loadStorage();
    },

    /**
     * Persist templates & meta to localStorage.
     */
    onPersistStorage: function onPersistStorage() {
      window.WorkoutsService.persistStorage();
    },

    // ── Read Operations (delegate to WorkoutsSelectors) ───

    getAllWorkouts:           function () { return window.WorkoutsSelectors.getAllWorkouts(); },
    getWorkoutsForDate:      function (date) { return window.WorkoutsSelectors.getWorkoutsForDate(date); },
    getTodayWorkouts:        function () { return window.WorkoutsSelectors.getTodayWorkouts(); },
    getTodaysActiveWorkout:  function () { return window.WorkoutsSelectors.getTodaysActiveWorkout(); },
    hasCompletedWorkoutToday:function () { return window.WorkoutsSelectors.hasCompletedWorkoutToday(); },
    getWorkoutById:          function (id) { return window.WorkoutsSelectors.getWorkoutById(id); },
    getThisWeekRoutine:      function () { return window.WorkoutsSelectors.getThisWeekRoutine(); },
    getWeeklyWorkoutSummary: function () { return window.WorkoutsSelectors.getWeeklyWorkoutSummary(); },
    getWorkoutStreak:        function () { return window.WorkoutsSelectors.getWorkoutStreak(); },
    getImprovementFocus:     function () { return window.WorkoutsSelectors.getImprovementFocus(); },
    getTemplates:            function () { return window.WorkoutsSelectors.getTemplates(); },
    getWorkoutMeta:          function (id) { return window.WorkoutsSelectors.getWorkoutMeta(id); },
    getCounts:               function () { return window.WorkoutsSelectors.getCounts(); }
  };

})();

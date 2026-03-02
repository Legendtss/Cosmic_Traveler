/**
 * ============================================================================
 * features/nutrition/nutrition.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and NutritionService / NutritionSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Other modules (AI chat, calendar, dashboard, statistics) should prefer
 * calling NutritionController methods over directly calling script.js globals.
 *
 * Exposed on window.NutritionController.
 *
 * Loaded AFTER nutrition.calculations.js, nutrition.selectors.js,
 * nutrition.service.js, and state/ files, but BEFORE script.js.
 */
(function () {
  'use strict';

  window.NutritionController = {

    // ── Write Operations (delegate to NutritionService) ───

    /**
     * Submit the nutrition form (manual or builder mode).
     * @param {Event} e — form submit event
     */
    onSubmitMeal: async function onSubmitMeal(e) {
      await window.NutritionService.submitMeal(e);
    },

    /**
     * Delete a logged meal entry.
     * @param {number|string} mealId
     */
    onDeleteMeal: async function onDeleteMeal(mealId) {
      await window.NutritionService.deleteMeal(mealId);
    },

    /**
     * Reload all meals from source.
     */
    onReload: async function onReload() {
      await window.NutritionService.reload();
    },

    // ── Saved Meal Presets ────────────────────────────────

    /**
     * Save current form as a meal preset.
     */
    onSavePreset: function onSavePreset() {
      window.NutritionService.saveMealPreset();
    },

    /**
     * Log a saved meal preset as today's entry.
     * @param {string} savedId
     */
    onUsePreset: async function onUsePreset(savedId) {
      await window.NutritionService.useMealPreset(savedId);
    },

    /**
     * Delete a saved meal preset.
     * @param {string} savedId
     */
    onDeletePreset: function onDeletePreset(savedId) {
      window.NutritionService.deleteMealPreset(savedId);
    },

    // ── AI Meal Detection ─────────────────────────────────

    /**
     * Toggle the AI meal detection panel.
     */
    onToggleAIPanel: function onToggleAIPanel() {
      if (typeof toggleAIMealLog === 'function') toggleAIMealLog();
    },

    /**
     * Submit food description for AI detection (Step 1).
     */
    onSubmitAIDetect: async function onSubmitAIDetect() {
      await window.NutritionService.submitAIDetect();
    },

    /**
     * Confirm and log AI-detected foods (Step 2).
     */
    onConfirmAIMeal: async function onConfirmAIMeal() {
      await window.NutritionService.confirmAIMeal();
    },

    /**
     * Cancel AI detection, reset panel.
     */
    onCancelAI: function onCancelAI() {
      window.NutritionService.cancelAIDetect();
    },

    /**
     * Update a single AI-detected item's macros when quantity changes.
     * @param {number} idx — item index
     * @param {number} newQty — new quantity in grams
     */
    onUpdateAIItemQty: function onUpdateAIItemQty(idx, newQty) {
      if (typeof updateAIItemMacros === 'function') updateAIItemMacros(idx, newQty);
    },

    /**
     * Remove an item from AI detection results.
     * @param {number} idx — item index
     */
    onRemoveAIItem: function onRemoveAIItem(idx) {
      if (typeof removeAIItem === 'function') removeAIItem(idx);
    },

    // ── Builder ───────────────────────────────────────────

    /**
     * Add food item to the nutrition builder.
     */
    onAddBuilderItem: function onAddBuilderItem() {
      window.NutritionService.addBuilderItem();
    },

    /**
     * Clear the nutrition builder.
     */
    onClearBuilder: function onClearBuilder() {
      window.NutritionService.clearBuilder();
    },

    /**
     * Switch form mode (manual / builder).
     * @param {'manual'|'builder'} mode
     */
    onSetMode: function onSetMode(mode) {
      window.NutritionService.setMode(mode);
    },

    /**
     * Reset the nutrition form.
     */
    onResetForm: function onResetForm() {
      window.NutritionService.resetForm();
    },

    // ── Profile Sync ──────────────────────────────────────

    /**
     * Sync nutrition goals from profile.
     */
    onSyncGoals: function onSyncGoals() {
      window.NutritionService.syncGoalsFromProfile();
    },

    // ── Read Operations (delegate to NutritionSelectors) ──

    getAllEntries:      function () { return window.NutritionSelectors.getAllEntries(); },
    getDailyLogs:      function (dateKey) { return window.NutritionSelectors.getDailyLogs(dateKey); },
    getTodayLogs:      function () { return window.NutritionSelectors.getTodayLogs(); },
    getTodayTotals:    function () { return window.NutritionSelectors.getTodayTotals(); },
    getBaseGoals:      function () { return window.NutritionSelectors.getBaseGoals(); },
    getGoalCalories:   function () { return window.NutritionSelectors.getGoalCalories(); },
    getMacroBreakdown: function () { return window.NutritionSelectors.getMacroBreakdown(); },
    getProteinProgress:function () { return window.NutritionSelectors.getProteinProgress(); },
    getCalorieProgress:function () { return window.NutritionSelectors.getCalorieProgress(); },
    getSavedMeals:     function () { return window.NutritionSelectors.getSavedMeals(); },
    getWeeklyCalories: function () { return window.NutritionSelectors.getWeeklyCalories(); },
    getCounts:         function () { return window.NutritionSelectors.getCounts(); },
    getEntryById:      function (id) { return window.NutritionSelectors.getEntryById(id); },

    // ── Calculations (delegate to NutritionCalcs) ─────────

    scaleMacros:        function (food, cat, qty) { return window.NutritionCalcs.scaleMacros(food, cat, qty); },
    sumMacros:          function (items) { return window.NutritionCalcs.sumMacros(items); },
    macroPercentages:   function (p, c, f) { return window.NutritionCalcs.macroPercentages(p, c, f); },
    progressPercent:    function (consumed, goal) { return window.NutritionCalcs.progressPercent(consumed, goal); }
  };

})();

/**
 * ============================================================================
 * features/nutrition/nutrition.service.js — Authoritative Write Layer
 * ============================================================================
 *
 * Every nutrition mutation flows through this service.
 * All functions delegate to existing script.js globals via late-binding.
 * Contains ZERO DOM access—DOM stays in script.js renderers.
 *
 * Dedup guard: 2-second window prevents rapid-fire duplicate writes
 * (same pattern as TasksService).
 *
 * Exposed on window.NutritionService.
 */
(function () {
  'use strict';

  /* ── Dedup guard (2 s window per operation key) ──────────── */
  var _lastOps = new Map();
  var DEDUP_MS = 2000;

  function _dedup(key) {
    var now = Date.now();
    if (_lastOps.has(key) && now - _lastOps.get(key) < DEDUP_MS) return true;
    _lastOps.set(key, now);
    return false;
  }

  /* ── Sync helper ─────────────────────────────────────────── */

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('meals');
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.NutritionService = {

    // ── Core CRUD (delegate to globals) ───────────────────

    /**
     * Reload all meal entries from API or demo store.
     * Delegates to global loadMeals().
     */
    reload: async function reload() {
      if (_dedup('reload')) return;
      if (typeof loadMeals === 'function') {
        await loadMeals();
      }
    },

    /**
     * Submit a new meal entry via the nutrition form.
     * Delegates to global submitNutritionForm(e).
     *
     * NOTE: This is called from the DOM form submit handler.
     * The global function handles demo/API branching, validation,
     * form reset, and triggers loadMeals() internally.
     *
     * @param {Event} e — form submit event
     */
    submitMeal: async function submitMeal(e) {
      if (typeof submitNutritionForm === 'function') {
        await submitNutritionForm(e);
      }
      _sync();
    },

    /**
     * Delete a meal entry by ID.
     * Delegates to global deleteMealEntry().
     *
     * @param {number|string} mealId
     */
    deleteMeal: async function deleteMeal(mealId) {
      if (_dedup('delete-' + mealId)) return;
      if (typeof deleteMealEntry === 'function') {
        await deleteMealEntry(mealId);
      }
      _sync();
    },

    // ── Saved Meals (Presets) ─────────────────────────────

    /**
     * Save the current form contents as a reusable meal preset.
     * Delegates to global saveCurrentMealPreset().
     */
    saveMealPreset: function saveMealPreset() {
      if (_dedup('save-preset')) return;
      if (typeof saveCurrentMealPreset === 'function') {
        saveCurrentMealPreset();
      }
      _sync();
    },

    /**
     * Log a saved meal preset as today's entry.
     * Delegates to global useSavedMeal(savedId).
     *
     * @param {string} savedId — preset ID
     */
    useMealPreset: async function useMealPreset(savedId) {
      if (_dedup('use-preset-' + savedId)) return;
      if (typeof useSavedMeal === 'function') {
        await useSavedMeal(savedId);
      }
      _sync();
    },

    /**
     * Delete a saved meal preset.
     * Delegates to global deleteSavedMeal(savedId).
     *
     * @param {string} savedId — preset ID
     */
    deleteMealPreset: function deleteMealPreset(savedId) {
      if (_dedup('del-preset-' + savedId)) return;
      if (typeof deleteSavedMeal === 'function') {
        deleteSavedMeal(savedId);
      }
      _sync();
    },

    // ── AI Meal Detection (Nutrition Tab) ─────────────────

    /**
     * Submit food text for AI detection (Step 1).
     * Delegates to global submitAIDetect().
     */
    submitAIDetect: async function submitAIDetectService() {
      if (_dedup('ai-detect')) return;
      if (typeof submitAIDetect === 'function') {
        await submitAIDetect();
      }
    },

    /**
     * Confirm AI-detected foods and log them (Step 2).
     * Delegates to global confirmAIMealLog().
     */
    confirmAIMeal: async function confirmAIMeal() {
      if (_dedup('ai-confirm')) return;
      if (typeof confirmAIMealLog === 'function') {
        await confirmAIMealLog();
      }
      _sync();
    },

    /**
     * Cancel AI confirmation, reset panel.
     * Delegates to global cancelAIConfirm().
     */
    cancelAIDetect: function cancelAIDetect() {
      if (typeof cancelAIConfirm === 'function') {
        cancelAIConfirm();
      }
    },

    // ── Profile → Nutrition Sync ──────────────────────────

    /**
     * Sync nutrition goals from profile state.
     * Delegates to global syncNutritionGoalWithProfile().
     */
    syncGoalsFromProfile: function syncGoalsFromProfile() {
      if (typeof syncNutritionGoalWithProfile === 'function') {
        syncNutritionGoalWithProfile();
      }
      _sync();
    },

    // ── Builder ───────────────────────────────────────────

    /**
     * Add a food item to the nutrition builder.
     * Delegates to global addNutritionBuilderItem().
     */
    addBuilderItem: function addBuilderItem() {
      if (typeof addNutritionBuilderItem === 'function') {
        addNutritionBuilderItem();
      }
    },

    /**
     * Clear the nutrition builder state.
     * Delegates to global clearNutritionBuilderState().
     */
    clearBuilder: function clearBuilder() {
      if (typeof clearNutritionBuilderState === 'function') {
        clearNutritionBuilderState();
      }
    },

    /**
     * Switch nutrition form mode (manual / builder).
     * Delegates to global nutritionSetMode().
     *
     * @param {'manual'|'builder'} mode
     */
    setMode: function setMode(mode) {
      if (typeof nutritionSetMode === 'function') {
        nutritionSetMode(mode);
      }
    },

    /**
     * Reset the nutrition form.
     * Delegates to global resetNutritionForm().
     */
    resetForm: function resetForm() {
      if (typeof resetNutritionForm === 'function') {
        resetNutritionForm();
      }
    }
  };

})();

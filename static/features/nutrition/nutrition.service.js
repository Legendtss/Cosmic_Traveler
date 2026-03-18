/**
 * features/nutrition/nutrition.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  var _dedup = _kit ? _kit.createDedup({ namespace: 'nutrition', windowMs: 2000 }) : function () { return false; };

  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'NutritionService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('meals');
  }

  window.NutritionService = {
    reload: async function reload() {
      if (_dedup('reload')) return;
      await _invoke('loadMeals', []);
    },

    submitMeal: async function submitMeal(e) {
      await _invoke('submitNutritionForm', [e]);
      _sync();
    },

    deleteMeal: async function deleteMeal(mealId) {
      if (_dedup('delete-' + mealId)) return;
      await _invoke('deleteMealEntry', [mealId]);
      _sync();
    },

    saveMealPreset: function saveMealPreset() {
      if (_dedup('save-preset')) return;
      _invoke('saveCurrentMealPreset', []);
      _sync();
    },

    useMealPreset: async function useMealPreset(savedId) {
      if (_dedup('use-preset-' + savedId)) return;
      await _invoke('useSavedMeal', [savedId]);
      _sync();
    },

    deleteMealPreset: function deleteMealPreset(savedId) {
      if (_dedup('del-preset-' + savedId)) return;
      _invoke('deleteSavedMeal', [savedId]);
      _sync();
    },

    submitAIDetect: async function submitAIDetectService() {
      if (_dedup('ai-detect')) return;
      await _invoke('submitAIDetect', []);
    },

    confirmAIMeal: async function confirmAIMeal() {
      if (_dedup('ai-confirm')) return;
      await _invoke('confirmAIMealLog', []);
      _sync();
    },

    cancelAIDetect: function cancelAIDetect() {
      _invoke('cancelAIConfirm', []);
    },

    syncGoalsFromProfile: function syncGoalsFromProfile() {
      _invoke('syncNutritionGoalWithProfile', []);
      _sync();
    },

    addBuilderItem: function addBuilderItem() {
      _invoke('addNutritionBuilderItem', []);
    },

    clearBuilder: function clearBuilder() {
      _invoke('clearNutritionBuilderState', []);
    },

    setMode: function setMode(mode) {
      _invoke('nutritionSetMode', [mode]);
    },

    resetForm: function resetForm() {
      _invoke('resetNutritionForm', []);
    }
  };
})();

/**
 * ============================================================================
 * features/nutrition/nutrition.selectors.js — Read-Only Query Layer
 * ============================================================================
 *
 * Pure read-only functions that query nutrition state.
 * NEVER mutates state or touches DOM.
 *
 * Reads from AppState when hydrated, falls back to nutritionState globals.
 * Delegates date helpers to existing globals via late-binding.
 *
 * Exposed on window.NutritionSelectors.
 */
(function () {
  'use strict';

  /* ── Private helpers ─────────────────────────────────────── */

  function _entries() {
    // Prefer AppState if hydrated
    if (typeof AppState !== 'undefined' && AppState.meals && AppState.meals.length) {
      return AppState.meals;
    }
    if (typeof nutritionState !== 'undefined' && nutritionState.entries) {
      return nutritionState.entries;
    }
    return [];
  }

  function _goals() {
    if (typeof nutritionState !== 'undefined' && nutritionState.baseGoals) {
      return nutritionState.baseGoals;
    }
    return { calories: 2000, protein: 50, carbs: 250, fats: 70 };
  }

  function _todayKey() {
    if (typeof todayDateKey === 'function') return todayDateKey();
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function _mealDateKey(entry) {
    if (typeof mealDateKey === 'function') return mealDateKey(entry);
    var raw = String(entry && (entry.date || '')).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    if (raw.includes('T')) return raw.split('T')[0];
    return '';
  }

  function _sum(items) {
    if (typeof NutritionCalcs !== 'undefined' && NutritionCalcs.sumMacros) {
      return NutritionCalcs.sumMacros(items);
    }
    var pm = typeof parseMacro === 'function' ? parseMacro : function (v) { return Number(v) || 0; };
    return items.reduce(function (a, e) {
      return {
        calories: a.calories + pm(e.calories),
        protein:  a.protein  + pm(e.protein),
        carbs:    a.carbs    + pm(e.carbs),
        fats:     a.fats     + pm(e.fats)
      };
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.NutritionSelectors = {

    // ── Entry Queries ─────────────────────────────────────

    /**
     * All nutrition log entries (today + historical).
     * @returns {Array}
     */
    getAllEntries: function () {
      return _entries();
    },

    /**
     * Entries for a specific date.
     * @param {string} dateKey — YYYY-MM-DD
     * @returns {Array}
     */
    getDailyLogs: function (dateKey) {
      return _entries().filter(function (e) {
        return _mealDateKey(e) === dateKey;
      });
    },

    /**
     * Today's entries.
     * @returns {Array}
     */
    getTodayLogs: function () {
      return this.getDailyLogs(_todayKey());
    },

    /**
     * Find a single entry by ID.
     * @param {number|string} mealId
     * @returns {Object|null}
     */
    getEntryById: function (mealId) {
      var id = String(mealId);
      return _entries().find(function (e) { return String(e.id) === id; }) || null;
    },

    // ── Aggregated Totals ─────────────────────────────────

    /**
     * Sum of macros for today.
     * @returns {{ calories: number, protein: number, carbs: number, fats: number }}
     */
    getTodayTotals: function () {
      return _sum(this.getTodayLogs());
    },

    /**
     * Sum of macros for a specific date.
     * @param {string} dateKey — YYYY-MM-DD
     * @returns {{ calories: number, protein: number, carbs: number, fats: number }}
     */
    getDailyTotals: function (dateKey) {
      return _sum(this.getDailyLogs(dateKey));
    },

    // ── Goals & Progress ──────────────────────────────────

    /**
     * Current base nutrition goals.
     * @returns {{ calories: number, protein: number, carbs: number, fats: number }}
     */
    getBaseGoals: function () {
      return _goals();
    },

    /**
     * Goal-adjusted calorie target (profile overrides base goal).
     * @returns {number}
     */
    getGoalCalories: function () {
      if (typeof NutritionCalcs !== 'undefined' && NutritionCalcs.getGoalAdjustedCalories) {
        return NutritionCalcs.getGoalAdjustedCalories();
      }
      if (typeof getGoalAdjustedCalories === 'function') return getGoalAdjustedCalories();
      return _goals().calories;
    },

    /**
     * Macro percentage breakdown of today's food intake.
     * @returns {{ protein: number, carbs: number, fats: number }} percentages 0–100
     */
    getMacroBreakdown: function () {
      var totals = this.getTodayTotals();
      if (typeof NutritionCalcs !== 'undefined' && NutritionCalcs.macroPercentages) {
        return NutritionCalcs.macroPercentages(totals.protein, totals.carbs, totals.fats);
      }
      var total = totals.protein + totals.carbs + totals.fats;
      if (total <= 0) return { protein: 0, carbs: 0, fats: 0 };
      return {
        protein: Math.round((totals.protein / total) * 100),
        carbs:   Math.round((totals.carbs   / total) * 100),
        fats:    Math.round((totals.fats    / total) * 100)
      };
    },

    /**
     * Protein progress as percentage of daily goal.
     * @returns {number} 0–100
     */
    getProteinProgress: function () {
      var totals = this.getTodayTotals();
      var goal = _goals().protein;
      if (!goal || goal <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((Math.max(0, totals.protein) / goal) * 100)));
    },

    /**
     * Calorie progress as percentage of daily goal.
     * @returns {number} 0–100
     */
    getCalorieProgress: function () {
      var totals = this.getTodayTotals();
      var goal = this.getGoalCalories();
      if (!goal || goal <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((Math.max(0, totals.calories) / goal) * 100)));
    },

    // ── Saved Meals ───────────────────────────────────────

    /**
     * All saved meal presets.
     * @returns {Array}
     */
    getSavedMeals: function () {
      if (typeof nutritionState !== 'undefined' && nutritionState.savedMeals) {
        return nutritionState.savedMeals;
      }
      return [];
    },

    /**
     * Saved meals filtered by meal type.
     * @param {string} mealType — 'breakfast', 'lunch', 'dinner', 'snack', 'other'
     * @returns {Array}
     */
    getSavedMealsByType: function (mealType) {
      return this.getSavedMeals().filter(function (m) {
        return m.meal_type === mealType;
      });
    },

    // ── Weekly / Trend ────────────────────────────────────

    /**
     * Weekly calorie analysis data.
     * @returns {{ avgCalories: number, totalCalories: number, onTrackDays: number }}
     */
    getWeeklyCalories: function () {
      var goal = this.getGoalCalories();
      if (typeof NutritionCalcs !== 'undefined' && NutritionCalcs.aggregateWeeklyTotals) {
        return NutritionCalcs.aggregateWeeklyTotals(_entries(), goal);
      }
      return { dailyTotals: {}, avgCalories: 0, totalCalories: 0, onTrackDays: 0 };
    },

    /**
     * Entry counts summary.
     * @returns {{ total: number, today: number, savedMeals: number }}
     */
    getCounts: function () {
      return {
        total:      _entries().length,
        today:      this.getTodayLogs().length,
        savedMeals: this.getSavedMeals().length
      };
    }
  };

})();

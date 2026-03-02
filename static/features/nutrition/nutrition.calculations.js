/**
 * ============================================================================
 * features/nutrition/nutrition.calculations.js — Pure Math Layer
 * ============================================================================
 *
 * Contains ZERO state mutation and ZERO DOM access.
 * Every function is a pure helper or delegates to existing globals.
 *
 * Exposed on window.NutritionCalcs.
 *
 * RULES:
 *   - No side effects.
 *   - No reading/writing nutritionState (use params instead).
 *   - All globals referenced via late-binding (called at invocation time).
 */
(function () {
  'use strict';

  /* ── Private helpers (thin wrappers over globals) ────────── */

  function _parseMacro(v) {
    return typeof parseMacro === 'function' ? parseMacro(v) : (Number(v) || 0);
  }

  function _round(v) {
    return typeof nutritionRound === 'function'
      ? nutritionRound(v)
      : Math.round((Number(v) || 0) * 10) / 10;
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.NutritionCalcs = {

    // ── Primitives ────────────────────────────────────────

    /**
     * Safe numeric parse (delegates to global parseMacro).
     * @param {*} value
     * @returns {number}
     */
    parseMacro: function (value) {
      return _parseMacro(value);
    },

    /**
     * Round to one decimal place (delegates to global nutritionRound).
     * @param {number} value
     * @returns {number}
     */
    round: function (value) {
      return _round(value);
    },

    // ── Scaling ───────────────────────────────────────────

    /**
     * Scale a food's per-100g macros by the given quantity.
     * Delegates to global nutritionBuildItemFromFood when available.
     *
     * @param {Object}  food      — food DB entry (cal, protein, carbs, fats, serving, unit)
     * @param {string}  category  — food category key
     * @param {number}  quantity  — user-entered quantity
     * @returns {Object} Scaled item object
     */
    scaleMacros: function (food, category, quantity) {
      if (typeof nutritionBuildItemFromFood === 'function') {
        return nutritionBuildItemFromFood(food, category, quantity);
      }
      // Inline fallback (matches script.js logic exactly)
      var ratio = 1;
      if (food.unit === 'whole') {
        ratio = quantity;
      } else if (food.unit === 'tablespoon') {
        ratio = (quantity * 15) / 100;
      } else {
        ratio = Math.max(0, Number(quantity) || 0) / 100;
      }
      return {
        calories: _round(food.calories * ratio),
        protein:  _round(food.protein  * ratio),
        carbs:    _round(food.carbs    * ratio),
        fats:     _round(food.fats     * ratio)
      };
    },

    /**
     * Re-scale a single AI-detected item's macros when its quantity changes.
     * Pure math — takes the old item + new quantity, returns new macro values.
     *
     * @param {Object} item     — { calories, protein, carbs, fats, quantity_g }
     * @param {number} newQty   — new quantity in grams
     * @param {number} oldQty   — previous quantity in grams (item.quantity_g)
     * @returns {{ calories: number, protein: number, carbs: number, fats: number }}
     */
    scaleAIItemMacros: function (item, newQty, oldQty) {
      if (!oldQty || oldQty <= 0) return { calories: 0, protein: 0, carbs: 0, fats: 0 };
      var factor = newQty / oldQty;
      return {
        calories: _round(_parseMacro(item.calories) * factor),
        protein:  _round(_parseMacro(item.protein)  * factor),
        carbs:    _round(_parseMacro(item.carbs)    * factor),
        fats:     _round(_parseMacro(item.fats)     * factor)
      };
    },

    // ── Aggregation ───────────────────────────────────────

    /**
     * Sum macros across an array of items (builder items, entries, etc.).
     *
     * @param {Array} items — array of objects with {calories, protein, carbs, fats}
     * @returns {{ calories: number, protein: number, carbs: number, fats: number }}
     */
    sumMacros: function (items) {
      var raw = (items || []).reduce(function (acc, item) {
        return {
          calories: acc.calories + _parseMacro(item.calories),
          protein:  acc.protein  + _parseMacro(item.protein),
          carbs:    acc.carbs    + _parseMacro(item.carbs),
          fats:     acc.fats     + _parseMacro(item.fats)
        };
      }, { calories: 0, protein: 0, carbs: 0, fats: 0 });
      return {
        calories: _round(raw.calories),
        protein:  _round(raw.protein),
        carbs:    _round(raw.carbs),
        fats:     _round(raw.fats)
      };
    },

    /**
     * Filter entries for a specific date and sum their macros.
     *
     * @param {Array}  entries  — nutritionState.entries
     * @param {string} dateKey  — YYYY-MM-DD
     * @returns {{ calories: number, protein: number, carbs: number, fats: number }}
     */
    aggregateDailyTotals: function (entries, dateKey) {
      var _mealDateKey = typeof mealDateKey === 'function' ? mealDateKey : function (e) {
        return String(e && (e.date || '')).slice(0, 10);
      };
      var dayEntries = (entries || []).filter(function (e) {
        return _mealDateKey(e) === dateKey;
      });
      return this.sumMacros(dayEntries);
    },

    /**
     * Compute weekly calorie data (daily sums for last 7 days).
     *
     * @param {Array}  entries       — nutritionState.entries
     * @param {number} goalCalories  — daily calorie goal
     * @returns {{ dailyTotals: Object, avgCalories: number, totalCalories: number, onTrackDays: number }}
     */
    aggregateWeeklyTotals: function (entries, goalCalories) {
      var _mealDateKey = typeof mealDateKey === 'function' ? mealDateKey : function (e) {
        return String(e && (e.date || '')).slice(0, 10);
      };
      var _getWeekStart = typeof getWeekStartDate === 'function' ? getWeekStartDate : function (d) {
        var date = new Date(d);
        var day = date.getDay();
        date.setDate(date.getDate() - day);
        return date;
      };

      var today = new Date();
      var weekStart = _getWeekStart(today);
      var weekEntries = (entries || []).filter(function (e) {
        var key = _mealDateKey(e);
        if (!key) return false;
        var parsed = new Date(key + 'T00:00:00');
        return !isNaN(parsed.getTime()) && parsed >= weekStart;
      });

      var dailyMap = {};
      weekEntries.forEach(function (e) {
        var key = _mealDateKey(e);
        if (!dailyMap[key]) dailyMap[key] = [];
        dailyMap[key].push(e);
      });

      var days = Object.keys(dailyMap).length;
      var totalCals = weekEntries.reduce(function (s, e) { return s + _parseMacro(e.calories); }, 0);
      var avgCalories = days > 0 ? Math.round(totalCals / days) : 0;

      var onTrackDays = 0;
      Object.keys(dailyMap).forEach(function (k) {
        var dayCals = dailyMap[k].reduce(function (s, e) { return s + _parseMacro(e.calories); }, 0);
        if (Math.abs(dayCals - goalCalories) <= goalCalories * 0.15) onTrackDays++;
      });

      return {
        dailyTotals:  dailyMap,
        avgCalories:  avgCalories,
        totalCalories: Math.round(totalCals),
        onTrackDays:  onTrackDays
      };
    },

    // ── Percentage / Progress ─────────────────────────────

    /**
     * Compute macro percentage breakdown (protein / carbs / fats as % of total).
     *
     * @param {number} protein
     * @param {number} carbs
     * @param {number} fats
     * @returns {{ protein: number, carbs: number, fats: number }}  percentages 0–100
     */
    macroPercentages: function (protein, carbs, fats) {
      var total = _parseMacro(protein) + _parseMacro(carbs) + _parseMacro(fats);
      if (total <= 0) return { protein: 0, carbs: 0, fats: 0 };
      return {
        protein: Math.round((_parseMacro(protein) / total) * 100),
        carbs:   Math.round((_parseMacro(carbs)   / total) * 100),
        fats:    Math.round((_parseMacro(fats)    / total) * 100)
      };
    },

    /**
     * Compute progress percentage (consumed vs goal), clamped 0–100.
     *
     * @param {number} consumed
     * @param {number} goal
     * @returns {number}
     */
    progressPercent: function (consumed, goal) {
      if (!goal || goal <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((Math.max(0, consumed) / goal) * 100)));
    },

    /**
     * Goal-adjusted daily calorie target (delegates to global).
     * @returns {number}
     */
    getGoalAdjustedCalories: function () {
      if (typeof getGoalAdjustedCalories === 'function') return getGoalAdjustedCalories();
      return 2000; // safe fallback
    }
  };

})();

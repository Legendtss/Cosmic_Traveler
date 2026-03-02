/**
 * ============================================================================
 * features/workouts/workouts.selectors.js — Read-Only Query Layer
 * ============================================================================
 *
 * Pure read-only functions that query workout state.
 * NEVER mutates state or touches DOM.
 *
 * Reads from AppState when hydrated, falls back to workoutState globals.
 * Delegates date helpers to existing globals via late-binding.
 *
 * Exposed on window.WorkoutsSelectors.
 */
(function () {
  'use strict';

  /* ── Private helpers ─────────────────────────────────────── */

  function _workouts() {
    if (typeof AppState !== 'undefined' && AppState.workouts && AppState.workouts.length) {
      return AppState.workouts;
    }
    if (typeof workoutState !== 'undefined' && workoutState.workouts) {
      return workoutState.workouts;
    }
    return [];
  }

  function _dateStr(d) {
    if (typeof dateStr === 'function') return dateStr(d);
    if (typeof toLocalDateKey === 'function') return toLocalDateKey(d || new Date());
    var dt = d || new Date();
    return dt.getFullYear() + '-' +
      String(dt.getMonth() + 1).padStart(2, '0') + '-' +
      String(dt.getDate()).padStart(2, '0');
  }

  function _isSameDay(a, b) {
    if (typeof isSameDayString === 'function') return isSameDayString(a, b);
    return String(a || '') === String(b || '');
  }

  function _weekBounds(offset) {
    if (typeof weekBounds === 'function') return weekBounds(offset || 0);
    var now = new Date();
    var start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - ((offset || 0) * 7));
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start: start, end: end };
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.WorkoutsSelectors = {

    // ── Entry Queries ─────────────────────────────────────

    /**
     * All workouts currently loaded.
     * @returns {Array}
     */
    getAllWorkouts: function () {
      return _workouts();
    },

    /**
     * Workouts for a specific date.
     * @param {string|Date} date — YYYY-MM-DD string or Date object
     * @returns {Array}
     */
    getWorkoutsForDate: function (date) {
      var key = typeof date === 'string' ? date : _dateStr(date);
      return _workouts().filter(function (w) {
        return _isSameDay(w.date, key);
      });
    },

    /**
     * Today's workouts (all, including completed).
     * @returns {Array}
     */
    getTodayWorkouts: function () {
      return this.getWorkoutsForDate(_dateStr());
    },

    /**
     * Today's first incomplete workout (the "active" one).
     * @returns {Object|null}
     */
    getTodaysActiveWorkout: function () {
      if (typeof todaysWorkout === 'function') return todaysWorkout();
      var today = _dateStr();
      return _workouts().find(function (w) {
        return _isSameDay(w.date, today) && !w.completed;
      }) || null;
    },

    /**
     * Whether the user has completed at least one workout today.
     * @returns {boolean}
     */
    hasCompletedWorkoutToday: function () {
      var today = _dateStr();
      return _workouts().some(function (w) {
        return _isSameDay(w.date, today) && w.completed;
      });
    },

    /**
     * Find a single workout by ID.
     * @param {number|string} workoutId
     * @returns {Object|null}
     */
    getWorkoutById: function (workoutId) {
      var id = Number(workoutId);
      return _workouts().find(function (w) { return w.id === id; }) || null;
    },

    // ── Weekly / Trend ────────────────────────────────────

    /**
     * Workouts within the current week bounds.
     * @returns {Array}
     */
    getThisWeekRoutine: function () {
      if (typeof thisWeekRoutine === 'function') return thisWeekRoutine();
      var bounds = _weekBounds(0);
      return _workouts().filter(function (w) {
        var d = new Date((w.date || _dateStr()) + 'T00:00:00');
        return d >= bounds.start && d < bounds.end;
      }).sort(function (a, b) {
        return String(a.date).localeCompare(String(b.date));
      });
    },

    /**
     * Count of completed workouts in a date range.
     * @param {Date} start
     * @param {Date} end
     * @returns {number}
     */
    getCompletedCountInRange: function (start, end) {
      if (typeof completedCountInRange === 'function') return completedCountInRange(start, end);
      return _workouts().filter(function (w) {
        var d = new Date((w.date || _dateStr()) + 'T00:00:00');
        return d >= start && d < end && w.completed;
      }).length;
    },

    /**
     * Weekly workout summary.
     * @returns {{ total: number, completed: number, remaining: number, weeklyTarget: number, streak: number }}
     */
    getWeeklyWorkoutSummary: function () {
      var bounds = _weekBounds(0);
      var weekWorkouts = this.getThisWeekRoutine();
      var completed = weekWorkouts.filter(function (w) { return w.completed; }).length;
      var target = (typeof workoutState !== 'undefined' && workoutState.weeklyTarget) || 5;
      var streak = typeof workoutStreak === 'function' ? workoutStreak() : 0;

      return {
        total: weekWorkouts.length,
        completed: completed,
        remaining: Math.max(0, weekWorkouts.length - completed),
        weeklyTarget: target,
        streak: streak
      };
    },

    /**
     * Consecutive-day workout streak (delegates to global).
     * @returns {number}
     */
    getWorkoutStreak: function () {
      if (typeof workoutStreak === 'function') return workoutStreak();
      return 0;
    },

    /**
     * Next improvement focus suggestion.
     * @returns {{ text: string, sub: string }|null}
     */
    getImprovementFocus: function () {
      if (typeof nextImprovementFocus === 'function') return nextImprovementFocus();
      return null;
    },

    // ── Templates ─────────────────────────────────────────

    /**
     * All saved workout templates.
     * @returns {Array}
     */
    getTemplates: function () {
      if (typeof workoutState !== 'undefined' && workoutState.templates) {
        return workoutState.templates;
      }
      return [];
    },

    /**
     * Workout meta for a given ID.
     * @param {number|string} workoutId
     * @returns {Object}
     */
    getWorkoutMeta: function (workoutId) {
      if (typeof workoutMeta === 'function') return workoutMeta(workoutId);
      return { completed: false, muscleGroup: '', estimatedDuration: 60 };
    },

    // ── Aggregates ────────────────────────────────────────

    /**
     * Entry counts summary.
     * @returns {{ total: number, today: number, completedToday: number, thisWeek: number }}
     */
    getCounts: function () {
      var today = _dateStr();
      var todayAll = this.getTodayWorkouts();
      return {
        total: _workouts().length,
        today: todayAll.length,
        completedToday: todayAll.filter(function (w) { return w.completed; }).length,
        thisWeek: this.getThisWeekRoutine().length
      };
    }
  };

})();

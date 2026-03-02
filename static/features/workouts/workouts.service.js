/**
 * ============================================================================
 * features/workouts/workouts.service.js — Authoritative Write Layer
 * ============================================================================
 *
 * Every workout mutation flows through this service.
 * All functions delegate to existing script.js globals via late-binding.
 * Contains ZERO DOM access—DOM stays in script.js renderers.
 *
 * Dedup guard: 2-second window prevents rapid-fire duplicate writes
 * (same pattern as TasksService / NutritionService).
 *
 * Exposed on window.WorkoutsService.
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
    if (typeof syncToAppState === 'function') syncToAppState('workouts');
  }

  /* ── Public API ──────────────────────────────────────────── */

  window.WorkoutsService = {

    // ── Core CRUD (delegate to globals) ───────────────────

    /**
     * Reload all workouts from API or demo store.
     * Delegates to global loadWorkoutsForPage().
     */
    reload: async function reload() {
      if (_dedup('reload')) return;
      if (typeof loadWorkoutsForPage === 'function') {
        await loadWorkoutsForPage();
      }
    },

    /**
     * Create a new workout entry.
     * Delegates to global createWorkout(payload).
     *
     * @param {Object} payload — { name, type, intensity, duration, calories_burned, notes, exercises[] }
     * @returns {Object|null} created workout object
     */
    createWorkout: async function createWorkoutService(payload) {
      if (_dedup('create-' + (payload && payload.name || ''))) return null;
      if (typeof createWorkout === 'function') {
        var result = await createWorkout(payload);
        _sync();
        return result;
      }
      return null;
    },

    /**
     * Mark a workout as completed.
     * Delegates to global completeWorkout(workoutId).
     * This internally persists meta, reloads page, and refreshes streaks.
     *
     * @param {number|string} workoutId
     */
    completeWorkout: async function completeWorkoutService(workoutId) {
      if (_dedup('complete-' + workoutId)) return;
      if (typeof completeWorkout === 'function') {
        await completeWorkout(workoutId);
      }
      _sync();
    },

    /**
     * Reschedule a workout to tomorrow (skip today).
     * Delegates to global skipWorkout(workoutId).
     *
     * @param {number|string} workoutId
     */
    skipWorkout: async function skipWorkoutService(workoutId) {
      if (_dedup('skip-' + workoutId)) return;
      if (typeof skipWorkout === 'function') {
        await skipWorkout(workoutId);
      }
      _sync();
    },

    /**
     * Update workout fields via API or demo store.
     * Delegates to global updateWorkoutApi(id, payload).
     *
     * @param {number|string} id
     * @param {Object} payload — fields to update
     * @returns {boolean} success
     */
    updateWorkout: async function updateWorkoutService(id, payload) {
      if (_dedup('update-' + id)) return false;
      if (typeof updateWorkoutApi === 'function') {
        var ok = await updateWorkoutApi(id, payload);
        _sync();
        return ok;
      }
      return false;
    },

    // ── Templates & Meta ──────────────────────────────────

    /**
     * Load templates and meta from localStorage.
     * Delegates to global loadWorkoutStorage().
     */
    loadStorage: function loadStorage() {
      if (typeof loadWorkoutStorage === 'function') {
        loadWorkoutStorage();
      }
    },

    /**
     * Persist templates and meta to localStorage.
     * Delegates to global persistWorkoutStorage().
     */
    persistStorage: function persistStorage() {
      if (typeof persistWorkoutStorage === 'function') {
        persistWorkoutStorage();
      }
    },

    /**
     * Save a new workout template.
     * Pushes to workoutState.templates and persists.
     *
     * @param {Object} template — { name, exercises[] }
     */
    saveTemplate: function saveTemplate(template) {
      if (_dedup('save-tpl-' + (template && template.name || ''))) return;
      if (typeof workoutState !== 'undefined' && workoutState.templates) {
        workoutState.templates.push({
          id: Date.now(),
          name: String(template.name || 'Template'),
          exercises: Array.isArray(template.exercises) ? template.exercises : []
        });
        this.persistStorage();
      }
    },

    /**
     * Delete a workout template by ID.
     *
     * @param {number|string} templateId
     */
    deleteTemplate: function deleteTemplate(templateId) {
      if (_dedup('del-tpl-' + templateId)) return;
      if (typeof workoutState !== 'undefined' && workoutState.templates) {
        workoutState.templates = workoutState.templates.filter(function (t) {
          return t.id !== Number(templateId);
        });
        this.persistStorage();
      }
    }
  };

})();

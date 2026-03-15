/**
 * ============================================================================
 * state/userState.js — Authoritative Mutation Layer
 * ============================================================================
 *
 * The ONLY place allowed to mutate AppState through state-aware wrappers.
 * Each function:
 *   1. Validates / dedup-guards the operation
 *   2. Calls the EXISTING logic (addTask, submitNutritionForm, etc.)
 *   3. Syncs AppState via syncToAppState()
 *
 * RULES:
 *   - Does NOT rewrite business logic — delegates to existing functions.
 *   - Contains dedup guards to prevent double logging.
 *   - All functions are exposed on `window` for global access.
 *
 * Loaded AFTER state/hydration.js and BEFORE script.js.
 */
(function () {
  'use strict';

  // ─── Dedup Guards ──────────────────────────────────────────────

  var _recentOps = {
    meals:    new Map(),   // hash → timestamp
    tasks:    new Map(),   // hash → timestamp
    workouts: new Map(),   // hash → timestamp
    streakEvalTs: 0,       // last evaluation timestamp
  };

  var DEDUP_WINDOW_MS = 2000; // ignore identical ops within 2 seconds

  function _opKey(data) {
    try { return JSON.stringify(data); }
    catch (_e) { return String(Date.now()); }
  }

  /**
   * Returns true if this operation was already performed within the
   * dedup window, meaning it should be SKIPPED.
   */
  function _isDuplicate(domain, data) {
    var map = _recentOps[domain];
    if (!map) return false;

    var key = _opKey(data);
    var lastTs = map.get(key);
    if (lastTs && (Date.now() - lastTs) < DEDUP_WINDOW_MS) {
      console.warn('[StateGuard] Duplicate ' + domain + ' operation blocked');
      return true;
    }

    map.set(key, Date.now());

    // Prune stale entries (keep map small)
    if (map.size > 100) {
      var cutoff = Date.now() - DEDUP_WINDOW_MS * 10;
      map.forEach(function (ts, k) {
        if (ts < cutoff) map.delete(k);
      });
    }
    return false;
  }

  // ─── Task Mutations ────────────────────────────────────────────

  /**
   * Create a task via the existing addTask() function, then sync.
   * Guards against duplicate rapid creation with the same title.
   */
  window.stateAddTask = async function stateAddTask(title, priority, dueHours, repeat, customDateTime, tags, noteContent, saveToNotes) {
    if (_isDuplicate('tasks', { a: 'add', t: title, p: priority })) return;
    await addTask(title, priority, dueHours, repeat, customDateTime, tags, noteContent, saveToNotes);
    syncToAppState('tasks');
  };

  /**
   * Complete / uncomplete a task via existing updateUserProgressAfterTaskCompletion().
   * Guards against double-completion within 2 s.
   */
  window.stateCompleteTask = async function stateCompleteTask(taskId, occDate) {
    if (_isDuplicate('tasks', { a: 'complete', id: taskId, d: occDate })) return;
    await updateUserProgressAfterTaskCompletion(taskId, occDate);
    syncToAppState('tasks');
  };

  /**
   * Delete a task via existing deleteTask(), then sync.
   */
  window.stateDeleteTask = async function stateDeleteTask(taskId) {
    if (_isDuplicate('tasks', { a: 'del', id: taskId })) return;
    await deleteTask(taskId);
    syncToAppState('tasks');
  };

  // ─── Nutrition Mutations ───────────────────────────────────────

  /**
   * Add a nutrition log entry (meal).
   * @param {Object} mealData — { name, meal_type, calories, protein, carbs, fats, date, time }
   * Guards against duplicate meal logging (same name + calories within 2 s).
   */
  window.stateAddNutritionLog = async function stateAddNutritionLog(mealData) {
    if (_isDuplicate('meals', { a: 'add', n: mealData.name, c: mealData.calories })) return;

    // API mode — POST to server
    var res = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mealData),
    });
    if (!res.ok) throw new Error('API error: ' + res.status);

    // Reload and sync
    await loadMeals();
    syncToAppState('meals');
  };

  /**
   * Delete a meal entry by ID, then sync.
   */
  window.stateDeleteMeal = async function stateDeleteMeal(mealId) {
    if (_isDuplicate('meals', { a: 'del', id: mealId })) return;
    await deleteMealEntry(mealId);
    syncToAppState('meals');
  };

  // ─── Workout Mutations ─────────────────────────────────────────

  /**
   * Create a workout via existing createWorkout(), then sync.
   * Guards against duplicate rapid creation with the same name.
   */
  window.stateAddWorkout = async function stateAddWorkout(payload) {
    if (_isDuplicate('workouts', { a: 'add', n: payload.name })) return;
    var result = await createWorkout(payload);
    await loadWorkoutsForPage();
    syncToAppState('workouts');
    return result;
  };

  // ─── Streak Mutations ──────────────────────────────────────────

  /**
   * Evaluate streaks with a cooldown guard.
   * Prevents re-evaluation within the dedup window.
   */
  window.stateEvaluateStreaks = async function stateEvaluateStreaks() {
    var now = Date.now();
    if ((now - _recentOps.streakEvalTs) < DEDUP_WINDOW_MS) {
      console.warn('[StateGuard] Streak re-evaluation blocked (cooldown)');
      return null;
    }
    _recentOps.streakEvalTs = now;
    var result = await evaluateStreaksAndPoints();
    if (result) {
      syncStreakResult(result);
    }
    return result;
  };

  // ─── Notes Mutations ───────────────────────────────────────────

  /**
   * Reload notes from API/store, then sync to AppState.
   */
  window.stateSyncNotes = async function stateSyncNotes() {
    if (window.NotesController && typeof window.NotesController.onReload === 'function') {
      await window.NotesController.onReload();
      return;
    }
    if (typeof loadNotes === 'function') {
      await loadNotes();
      return;
    }
    syncToAppState('notes');
  };

  // ─── Focus Mutations ───────────────────────────────────────────

  /**
   * Sync focus sessions to AppState after a session completes.
   */
  window.stateSyncFocus = function stateSyncFocus() {
    syncToAppState('focus');
  };

  // ─── Profile Mutations ─────────────────────────────────────────

  /**
   * Sync profile state to AppState after a save.
   */
  window.stateSyncProfile = function stateSyncProfile() {
    syncToAppState('profile');
  };

  // ─── Projects Mutations ────────────────────────────────────────

  /**
   * Sync projects to AppState after a mutation.
   */
  window.stateSyncProjects = function stateSyncProjects() {
    syncToAppState('projects');
  };

})();

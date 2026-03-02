/**
 * ============================================================================
 * features/tasks/tasks.service.js — Task Business Logic (Write Operations)
 * ============================================================================
 *
 * Authoritative write layer for task mutations. Every function here
 * DELEGATES to the existing functions in script.js — no logic is
 * duplicated or rewritten.
 *
 * Responsibilities:
 *   - Create / update / delete / complete tasks
 *   - Tag & quadrant assignment
 *   - Persist via existing mechanisms (localStorage or API)
 *   - Sync AppState after every mutation
 *
 * RULES:
 *   - Does NOT contain business logic — delegates to existing globals.
 *   - Does NOT manipulate the DOM.
 *   - Exposes functions on window.TasksService.
 *
 * Loaded AFTER state/ files and BEFORE script.js.
 * All delegated functions (addTask, deleteTask, etc.) are defined in
 * script.js which loads after this file. We use late-binding (calling
 * globals at invocation time, not at parse time).
 */
(function () {
  'use strict';

  // ── Dedup guard ────────────────────────────────────────────────

  var _lastOps = new Map();
  var DEDUP_MS = 2000;

  function _opKey(data) {
    try { return JSON.stringify(data); }
    catch (_) { return String(Date.now()); }
  }

  function _isDup(data) {
    var key = _opKey(data);
    var last = _lastOps.get(key);
    if (last && (Date.now() - last) < DEDUP_MS) {
      console.warn('[TasksService] Duplicate operation blocked:', key);
      return true;
    }
    _lastOps.set(key, Date.now());
    if (_lastOps.size > 80) {
      var cutoff = Date.now() - DEDUP_MS * 5;
      _lastOps.forEach(function (ts, k) { if (ts < cutoff) _lastOps.delete(k); });
    }
    return false;
  }

  // ── Service API ────────────────────────────────────────────────

  window.TasksService = {

    // ── Create ─────────────────────────────────────────────────

    /**
     * Create a new task. Delegates to the global addTask() function.
     * @param {string} title
     * @param {string} priority  'low'|'medium'|'high'
     * @param {string} dueDate   YYYY-MM-DD date string
     * @param {string} repeat    'none'|'daily'|'weekly'|'monthly'|'interval:N'
     * @param {string[]} tags
     * @param {string} noteContent
     * @param {boolean} saveToNotes
     * @returns {Promise<void>}
     */
    createTask: async function createTask(title, priority, dueDate, repeat, tags, noteContent, saveToNotes) {
      if (_isDup({ a: 'create', t: title, p: priority })) return;
      await addTask(title, priority, dueDate, repeat, tags || [], noteContent || '', saveToNotes || false);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    // ── Read (delegates to selectors) ──────────────────────────

    /**
     * Reload tasks from API/localStorage. Delegates to global loadTasks().
     * @returns {Promise<void>}
     */
    reload: async function reload() {
      await loadTasks();
      // loadTasks already calls syncToAppState('tasks')
    },

    // ── Update ─────────────────────────────────────────────────

    /**
     * Update a task's fields. Delegates to global updateTask().
     * @param {number|string} taskId
     * @param {Object} payload  fields to merge
     * @returns {Promise<boolean>}
     */
    updateTask: async function updateTaskFn(taskId, payload) {
      var ok = await updateTask(taskId, payload);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
      return ok;
    },

    // ── Delete ─────────────────────────────────────────────────

    /**
     * Delete a task by ID. Delegates to global deleteTask().
     * @param {number|string} taskId
     * @returns {Promise<void>}
     */
    deleteTask: async function deleteTaskFn(taskId) {
      if (_isDup({ a: 'del', id: taskId })) return;
      await deleteTask(taskId);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    // ── Complete / Toggle ──────────────────────────────────────

    /**
     * Toggle task completion. Delegates to global toggleTask().
     * @param {number|string} taskId
     * @param {string|null} occDate  YYYY-MM-DD for recurring tasks
     * @returns {Promise<void>}
     */
    completeTask: async function completeTaskFn(taskId, occDate) {
      if (_isDup({ a: 'complete', id: taskId, d: occDate })) return;
      await toggleTask(taskId, occDate);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    // ── Tag Assignment ─────────────────────────────────────────

    /**
     * Set tags for a task via the enhancement system.
     * @param {number|string} taskId
     * @param {string[]} tags
     */
    setTags: function setTags(taskId, tags) {
      if (typeof updateTaskEnhancement !== 'function') return;
      updateTaskEnhancement(taskId, function (ext) {
        ext.tags = (typeof normalizeTaskTags === 'function')
          ? normalizeTaskTags(tags)
          : (Array.isArray(tags) ? tags : []);
      });
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    // ── Quadrant (Eisenhower Matrix) ───────────────────────────

    /**
     * Assign Eisenhower quadrant to a task.
     * @param {number|string} taskId
     * @param {string} quadrant  e.g. 'urgent_important'
     */
    setQuadrant: function setQuadrant(taskId, quadrant) {
      if (typeof persistTaskQuadrant === 'function') {
        persistTaskQuadrant(taskId, quadrant);
      }
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    // ── Enhancement Mutation ───────────────────────────────────

    /**
     * Generic enhancement updater. Delegates to global updateTaskEnhancement().
     * @param {number|string} taskId
     * @param {Function} updater  fn(ext) — mutate the enhancement object
     */
    updateEnhancement: function updateEnhancement(taskId, updater) {
      if (typeof updateTaskEnhancement === 'function') {
        updateTaskEnhancement(taskId, updater);
      }
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    // ── Layout Preference ──────────────────────────────────────

    /**
     * Save the task view layout preference (list | matrix | tag).
     * @param {'list'|'matrix'|'tag'} layout
     */
    setLayout: function setLayout(layout) {
      if (typeof saveTaskLayoutPreference === 'function') {
        saveTaskLayoutPreference(layout);
      }
    },

    /**
     * Load current layout preference.
     * @returns {'list'|'matrix'|'tag'}
     */
    getLayout: function getLayout() {
      if (typeof loadTaskLayoutPreference === 'function') {
        return loadTaskLayoutPreference();
      }
      return 'list';
    },
  };

})();

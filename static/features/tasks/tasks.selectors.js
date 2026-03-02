/**
 * ============================================================================
 * features/tasks/tasks.selectors.js — Read-Only Task Queries
 * ============================================================================
 *
 * Pure read-only functions that query task data from AppState and the
 * existing module-level state objects (taskUiState, taskEnhancements).
 *
 * RULES:
 *   - NEVER mutate state.
 *   - NEVER call fetch() or write localStorage.
 *   - Return new arrays/objects (no direct references to internal arrays).
 *   - All functions are exposed on window.TasksSelectors.
 *
 * Loaded AFTER state/ files and BEFORE script.js.
 * Falls back gracefully to module-level state if AppState isn't hydrated.
 */
(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Returns the authoritative tasks array.
   * Prefers AppState if hydrated, falls back to taskUiState.
   */
  function _tasks() {
    if (window.AppState && window.AppState.hydrated && window.AppState.tasks.length) {
      return window.AppState.tasks;
    }
    if (typeof taskUiState !== 'undefined') {
      return taskUiState.tasks || [];
    }
    return [];
  }

  /**
   * Returns today's date key in YYYY-MM-DD format.
   */
  function _todayKey() {
    if (typeof toLocalDateKey === 'function') return toLocalDateKey(new Date());
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // ── Selectors ──────────────────────────────────────────────────

  window.TasksSelectors = {

    /**
     * All tasks (shallow copy).
     * @returns {Array}
     */
    getAllTasks: function getAllTasks() {
      return _tasks().slice();
    },

    /**
     * Tasks that are not completed and not overdue.
     * For recurring tasks, checks the current occurrence.
     * @returns {Array}
     */
    getActiveTasks: function getActiveTasks() {
      var todayKey = _todayKey();
      return _tasks().filter(function (t) {
        var done = _isTaskDone(t, todayKey);
        if (done) return false;
        var dueKey = t.date || todayKey;
        return dueKey >= todayKey;
      });
    },

    /**
     * Completed tasks (non-recurring: completed flag; recurring: today's occurrence done).
     * @returns {Array}
     */
    getCompletedTasks: function getCompletedTasks() {
      var todayKey = _todayKey();
      return _tasks().filter(function (t) {
        return _isTaskDone(t, todayKey);
      });
    },

    /**
     * Tasks that are past due and not completed.
     * @returns {Array}
     */
    getOverdueTasks: function getOverdueTasks() {
      var todayKey = _todayKey();
      return _tasks().filter(function (t) {
        if (_isTaskDone(t, todayKey)) return false;
        var dueKey = t.date || todayKey;
        return dueKey < todayKey;
      });
    },

    /**
     * Tasks that have a specific tag (case-insensitive).
     * @param {string} tag
     * @returns {Array}
     */
    getTasksByTag: function getTasksByTag(tag) {
      var needle = String(tag || '').trim().toLowerCase();
      if (!needle) return [];
      return _tasks().filter(function (t) {
        var tags = _getTaskTags(t);
        return tags.some(function (tg) {
          return String(tg).toLowerCase() === needle;
        });
      });
    },

    /**
     * Tasks due today (all states).
     * @returns {Array}
     */
    getTasksDueToday: function getTasksDueToday() {
      var todayKey = _todayKey();
      return _tasks().filter(function (t) {
        if (typeof taskOccursOnDate === 'function') {
          return taskOccursOnDate(t, todayKey);
        }
        return (t.date || todayKey) === todayKey;
      });
    },

    /**
     * return tasks filtered by Eisenhower quadrant key.
     * @param {string} quadrantKey e.g. 'urgent_important'
     * @returns {Array}
     */
    getTasksByQuadrant: function getTasksByQuadrant(quadrantKey) {
      return _tasks().filter(function (t) {
        var q = _getQuadrant(t);
        return q === quadrantKey;
      });
    },

    /**
     * Count of tasks by status.
     * @returns {{ total: number, active: number, completed: number, overdue: number }}
     */
    getTaskCounts: function getTaskCounts() {
      var todayKey = _todayKey();
      var total = 0, active = 0, completed = 0, overdue = 0;
      _tasks().forEach(function (t) {
        total++;
        if (_isTaskDone(t, todayKey)) {
          completed++;
        } else if ((t.date || todayKey) < todayKey) {
          overdue++;
        } else {
          active++;
        }
      });
      return { total: total, active: active, completed: completed, overdue: overdue };
    },

    /**
     * All unique tags across all tasks.
     * @returns {string[]}
     */
    getAllTags: function getAllTags() {
      var tagSet = {};
      _tasks().forEach(function (t) {
        _getTaskTags(t).forEach(function (tag) {
          tagSet[tag.toLowerCase()] = tag;
        });
      });
      return Object.values(tagSet);
    },

    /**
     * Find a task by ID.
     * @param {number|string} taskId
     * @returns {Object|null}
     */
    getTaskById: function getTaskById(taskId) {
      var id = Number(taskId);
      var found = _tasks().find(function (t) { return Number(t.id) === id; });
      return found || null;
    },
  };

  // ── Private helpers (delegate to existing globals when available) ──

  function _taskDueAt(task) {
    if (typeof taskDueAt === 'function') return taskDueAt(task);
    return new Date((task.date || '') + 'T23:59:59');
  }

  function _isTaskDone(task, dateKey) {
    if (typeof isTaskOccurrenceDone === 'function') return isTaskOccurrenceDone(task, dateKey);
    return !!task.completed || !!task.completedAt;
  }

  function _getTaskTags(task) {
    if (typeof getTaskTags === 'function') return getTaskTags(task);
    return Array.isArray(task.tags) ? task.tags : [];
  }

  function _getQuadrant(task) {
    if (typeof getTaskQuadrant === 'function') return getTaskQuadrant(task);
    return String(task.eisenhowerQuadrant || '').toLowerCase();
  }

})();

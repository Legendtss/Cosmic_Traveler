/**
 * ============================================================================
 * features/projects/projects.selectors.js — Read-Only Projects Queries
 * ============================================================================
 *
 * Pure read-only functions that query project state.
 * Reads from AppState when hydrated, falls back to projectsState.
 *
 * Exposed on window.ProjectsSelectors.
 */
(function () {
  'use strict';

  function _projects() {
    if (typeof AppState !== 'undefined' && AppState.projects && AppState.projects.length) {
      return AppState.projects;
    }
    if (typeof projectsState !== 'undefined') return projectsState.projects || [];
    return [];
  }

  window.ProjectsSelectors = {

    getAll: function () { return _projects().slice(); },

    getById: function (id) {
      return _projects().find(function (p) { return p.id === id; }) || null;
    },

    /**
     * Count of projects and total tasks across all projects.
     * @returns {{ projects: number, tasks: number, completedTasks: number }}
     */
    getCounts: function () {
      var ps = _projects();
      var tasks = 0, completed = 0;
      ps.forEach(function (p) {
        (p.tasks || []).forEach(function (t) {
          tasks++;
          if (t.completed) completed++;
        });
      });
      return { projects: ps.length, tasks: tasks, completedTasks: completed };
    }
  };

})();

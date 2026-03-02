/**
 * ============================================================================
 * features/projects/projects.service.js — Projects Mutations
 * ============================================================================
 *
 * Write-side operations for projects. Delegates to existing globals.
 * All mutations persist to localStorage and sync AppState.
 *
 * Exposed on window.ProjectsService.
 */
(function () {
  'use strict';

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('projects');
  }

  window.ProjectsService = {

    addProject: function (project) {
      if (typeof addProject === 'function') addProject(project);
      _sync();
    },

    deleteProject: function (projectId) {
      if (typeof deleteProject === 'function') deleteProject(projectId);
      _sync();
    },

    addTask: function (projectId) {
      if (typeof addProjectTask === 'function') addProjectTask(projectId);
      _sync();
    },

    deleteTask: function (projectId, taskId) {
      if (typeof deleteProjectTask === 'function') deleteProjectTask(projectId, taskId);
      _sync();
    },

    toggleTaskComplete: function (projectId, taskId) {
      if (typeof toggleProjectTaskComplete === 'function') toggleProjectTaskComplete(projectId, taskId);
      _sync();
    },

    addSubtask: function (projectId, taskId) {
      if (typeof addProjectSubtask === 'function') addProjectSubtask(projectId, taskId);
      _sync();
    },

    toggleSubtask: function (projectId, taskId, subtaskId) {
      if (typeof toggleProjectSubtask === 'function') toggleProjectSubtask(projectId, taskId, subtaskId);
      _sync();
    },

    deleteSubtask: function (projectId, taskId, subtaskId) {
      if (typeof deleteProjectSubtask === 'function') deleteProjectSubtask(projectId, taskId, subtaskId);
      _sync();
    },

    startTimer: function (projectId, taskId) {
      if (typeof startProjectTimer === 'function') startProjectTimer(projectId, taskId);
    },

    stopTimer: function () {
      if (typeof stopActiveTimer === 'function') stopActiveTimer();
      _sync();
    }
  };

})();

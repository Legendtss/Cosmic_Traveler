/**
 * ============================================================================
 * features/projects/projects.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and ProjectsService / ProjectsSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.ProjectsController.
 *
 * Loaded AFTER projects.selectors.js, projects.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.ProjectsController = {

    // ── Write Operations ──────────────────────────────────────

    onAddProject: function (project) {
      window.ProjectsService.addProject(project);
    },

    onDeleteProject: function (projectId) {
      window.ProjectsService.deleteProject(projectId);
    },

    onAddTask: function (projectId) {
      window.ProjectsService.addTask(projectId);
    },

    onDeleteTask: function (projectId, taskId) {
      window.ProjectsService.deleteTask(projectId, taskId);
    },

    onToggleTaskComplete: function (projectId, taskId) {
      window.ProjectsService.toggleTaskComplete(projectId, taskId);
    },

    onAddSubtask: function (projectId, taskId) {
      window.ProjectsService.addSubtask(projectId, taskId);
    },

    onToggleSubtask: function (projectId, taskId, subtaskId) {
      window.ProjectsService.toggleSubtask(projectId, taskId, subtaskId);
    },

    onDeleteSubtask: function (projectId, taskId, subtaskId) {
      window.ProjectsService.deleteSubtask(projectId, taskId, subtaskId);
    },

    onStartTimer: function (projectId, taskId) {
      window.ProjectsService.startTimer(projectId, taskId);
    },

    onStopTimer: function () {
      window.ProjectsService.stopTimer();
    },

    // ── Read Operations ───────────────────────────────────────

    getAll:    function ()   { return window.ProjectsSelectors.getAll(); },
    getById:   function (id) { return window.ProjectsSelectors.getById(id); },
    getCounts: function ()   { return window.ProjectsSelectors.getCounts(); }
  };

})();

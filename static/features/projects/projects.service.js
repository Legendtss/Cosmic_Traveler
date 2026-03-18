/**
 * features/projects/projects.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'ProjectsService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('projects');
  }

  window.ProjectsService = {
    addProject: function (project) { _invoke('addProject', [project]); _sync(); },
    deleteProject: function (projectId) { _invoke('deleteProject', [projectId]); _sync(); },
    addTask: function (projectId) { _invoke('addProjectTask', [projectId]); _sync(); },
    deleteTask: function (projectId, taskId) { _invoke('deleteProjectTask', [projectId, taskId]); _sync(); },
    toggleTaskComplete: function (projectId, taskId) { _invoke('toggleProjectTaskComplete', [projectId, taskId]); _sync(); },
    addSubtask: function (projectId, taskId) { _invoke('addProjectSubtask', [projectId, taskId]); _sync(); },
    toggleSubtask: function (projectId, taskId, subtaskId) { _invoke('toggleProjectSubtask', [projectId, taskId, subtaskId]); _sync(); },
    deleteSubtask: function (projectId, taskId, subtaskId) { _invoke('deleteProjectSubtask', [projectId, taskId, subtaskId]); _sync(); },
    startTimer: function (projectId, taskId) { _invoke('startProjectTimer', [projectId, taskId]); },
    stopTimer: function () { _invoke('stopActiveTimer', []); _sync(); }
  };
})();

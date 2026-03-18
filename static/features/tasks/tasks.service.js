/**
 * features/tasks/tasks.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  var _isDup = _kit
    ? _kit.createJsonDedup({ namespace: 'tasks', windowMs: 2000, maxEntries: 80 })
    : function () { return false; };

  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'TasksService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  window.TasksService = {
    createTask: async function createTask(title, priority, dueDate, repeat, tags, noteContent, saveToNotes) {
      if (_isDup({ a: 'create', t: title, p: priority })) return;
      await _invoke('addTask', [title, priority, dueDate, repeat, tags || [], noteContent || '', !!saveToNotes]);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    reload: async function reload() {
      await _invoke('loadTasks', []);
    },

    updateTask: async function updateTaskFn(taskId, payload) {
      var ok = await _invoke('updateTask', [taskId, payload], false);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
      return !!ok;
    },

    deleteTask: async function deleteTaskFn(taskId) {
      if (_isDup({ a: 'del', id: taskId })) return;
      await _invoke('deleteTask', [taskId]);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    completeTask: async function completeTaskFn(taskId, occDate) {
      if (_isDup({ a: 'complete', id: taskId, d: occDate })) return;
      await _invoke('toggleTask', [taskId, occDate]);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    setTags: function setTags(taskId, tags) {
      var updater = function (ext) {
        ext.tags = (typeof normalizeTaskTags === 'function')
          ? normalizeTaskTags(tags)
          : (Array.isArray(tags) ? tags : []);
      };
      _invoke('updateTaskEnhancement', [taskId, updater]);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    setQuadrant: function setQuadrant(taskId, quadrant) {
      _invoke('persistTaskQuadrant', [taskId, quadrant]);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    updateEnhancement: function updateEnhancement(taskId, updater) {
      _invoke('updateTaskEnhancement', [taskId, updater]);
      if (typeof syncToAppState === 'function') syncToAppState('tasks');
    },

    setLayout: function setLayout(layout) {
      _invoke('saveTaskLayoutPreference', [layout]);
    },

    getLayout: function getLayout() {
      return _invoke('loadTaskLayoutPreference', [], 'list');
    }
  };
})();

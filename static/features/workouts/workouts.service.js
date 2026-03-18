/**
 * features/workouts/workouts.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  var _dedup = _kit ? _kit.createDedup({ namespace: 'workouts', windowMs: 2000 }) : function () { return false; };

  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'WorkoutsService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('workouts');
  }

  window.WorkoutsService = {
    reload: async function reload() {
      if (_dedup('reload')) return;
      await _invoke('loadWorkoutsForPage', []);
    },

    createWorkout: async function createWorkoutService(payload) {
      if (_dedup('create-' + ((payload && payload.name) || ''))) return null;
      var result = await _invoke('createWorkout', [payload], null);
      _sync();
      return result;
    },

    completeWorkout: async function completeWorkoutService(workoutId) {
      if (_dedup('complete-' + workoutId)) return;
      await _invoke('completeWorkout', [workoutId]);
      _sync();
    },

    skipWorkout: async function skipWorkoutService(workoutId) {
      if (_dedup('skip-' + workoutId)) return;
      await _invoke('skipWorkout', [workoutId]);
      _sync();
    },

    updateWorkout: async function updateWorkoutService(id, payload) {
      if (_dedup('update-' + id)) return false;
      var ok = await _invoke('updateWorkoutApi', [id, payload], false);
      _sync();
      return !!ok;
    },

    loadStorage: function loadStorage() {
      _invoke('loadWorkoutStorage', []);
    },

    persistStorage: function persistStorage() {
      _invoke('persistWorkoutStorage', []);
    },

    saveTemplate: function saveTemplate(template) {
      if (_dedup('save-tpl-' + ((template && template.name) || ''))) return;
      if (typeof workoutState !== 'undefined' && workoutState.templates) {
        workoutState.templates.push({
          id: Date.now(),
          name: String((template && template.name) || 'Template'),
          exercises: Array.isArray(template && template.exercises) ? template.exercises : []
        });
        this.persistStorage();
      }
    },

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

/**
 * features/profile/profile.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'ProfileService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  window.ProfileService = {
    save: function () {
      _invoke('persistProfileState', []);
      if (typeof syncToAppState === 'function') syncToAppState('profile');
    },
    setTheme: function (theme) {
      _invoke('applyTheme', [theme]);
      if (typeof syncToAppState === 'function') syncToAppState('profile');
    },
    syncNutritionGoals: function () {
      _invoke('syncNutritionGoalWithProfile', []);
    }
  };
})();

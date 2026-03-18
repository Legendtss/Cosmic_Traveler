/**
 * features/dashboard/dashboard.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'DashboardService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  window.DashboardService = {
    refreshMetrics: function () { _invoke('refreshDashboardMetrics', []); },
    saveQuickActions: function (actions) { _invoke('persistDashboardQuickActions', [actions]); },
    runQuickAction: function (actionId) { _invoke('runDashboardQuickAction', [actionId]); },
    toggleTimer: function () { _invoke('toggleDashboardTimer', []); }
  };
})();

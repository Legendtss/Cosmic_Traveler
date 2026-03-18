/**
 * features/statistics/statistics.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'StatisticsService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  window.StatisticsService = {
    refresh: function () { _invoke('updateStatisticsForActiveUser', []); },
    render: function () { _invoke('renderStatistics', []); }
  };
})();

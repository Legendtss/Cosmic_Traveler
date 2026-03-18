/**
 * features/streaks/streaks.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  var _dedup = _kit ? _kit.createDedup({ namespace: 'streaks', windowMs: 2000 }) : function () { return false; };

  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'StreaksService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  window.StreaksService = {
    evaluate: async function () {
      if (_dedup('evaluate')) return null;
      var result = await _invoke('evaluateStreaksAndPoints', [], null);
      if (result) _invoke('syncStreakResult', [result]);
      return result;
    },

    refreshUI: function () {
      _invoke('refreshStreaksAfterChange', []);
    }
  };
})();

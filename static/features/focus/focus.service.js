/**
 * features/focus/focus.service.js
 */
(function () {
  'use strict';

  var _kit = window.FeatureServiceKit || null;
  function _invoke(name, args, fallback) {
    if (_kit) return _kit.invoke(name, args, { feature: 'FocusService', fallback: fallback });
    var fn = window[name];
    return typeof fn === 'function' ? fn.apply(window, args || []) : fallback;
  }

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('focus');
  }

  window.FocusService = {
    start: function () { _invoke('focusTimerStart', []); },
    pause: function () { _invoke('focusTimerPause', []); },
    resume: function () { _invoke('focusTimerResume', []); },
    stop: function () { _invoke('focusTimerStop', []); _sync(); },
    reset: function () { _invoke('focusTimerReset', []); },
    switchMode: function (mode) { _invoke('switchFocusMode', [mode]); },
    setPomodoroDuration: function (mins) { _invoke('setPomodoroDuration', [mins]); },
    setPomodoroBreak: function (mins) { _invoke('setPomodoroBreak', [mins]); },
    setPomodoroSessions: function (count) { _invoke('setPomodoroSessions', [count]); },
    selectTrack: function (trackId) { _invoke('selectFocusTrack', [trackId]); },
    toggleAudio: function () { _invoke('toggleFocusAudio', []); },
    setVolume: function (vol) { _invoke('setFocusVolume', [vol]); },
    toggleFocusMode: function () { _invoke('toggleFocusMode', []); }
  };
})();

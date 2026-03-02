/**
 * ============================================================================
 * features/focus/focus.service.js — Focus Timer Mutations
 * ============================================================================
 *
 * Write-side operations for the focus/pomodoro timer.
 * Delegates to existing globals.
 *
 * Exposed on window.FocusService.
 */
(function () {
  'use strict';

  function _sync() {
    if (typeof syncToAppState === 'function') syncToAppState('focus');
  }

  window.FocusService = {

    start:   function () { if (typeof focusTimerStart  === 'function') focusTimerStart();  },
    pause:   function () { if (typeof focusTimerPause  === 'function') focusTimerPause();  },
    resume:  function () { if (typeof focusTimerResume === 'function') focusTimerResume(); },
    stop:    function () { if (typeof focusTimerStop   === 'function') focusTimerStop();  _sync(); },
    reset:   function () { if (typeof focusTimerReset  === 'function') focusTimerReset(); },

    switchMode: function (mode) {
      if (typeof switchFocusMode === 'function') switchFocusMode(mode);
    },

    setPomodoroDuration: function (mins) {
      if (typeof setPomodoroDuration === 'function') setPomodoroDuration(mins);
    },

    setPomodoroBreak: function (mins) {
      if (typeof setPomodoroBreak === 'function') setPomodoroBreak(mins);
    },

    setPomodoroSessions: function (count) {
      if (typeof setPomodoroSessions === 'function') setPomodoroSessions(count);
    },

    selectTrack: function (trackId) {
      if (typeof selectFocusTrack === 'function') selectFocusTrack(trackId);
    },

    toggleAudio: function () {
      if (typeof toggleFocusAudio === 'function') toggleFocusAudio();
    },

    setVolume: function (vol) {
      if (typeof setFocusVolume === 'function') setFocusVolume(vol);
    },

    toggleFocusMode: function () {
      if (typeof toggleFocusMode === 'function') toggleFocusMode();
    }
  };

})();

/**
 * ============================================================================
 * features/focus/focus.controller.js — UI ↔ Service Bridge
 * ============================================================================
 *
 * Thin bridge between DOM events and FocusService / FocusSelectors.
 * Contains ZERO business logic — every handler delegates immediately.
 *
 * Exposed on window.FocusController.
 *
 * Loaded AFTER focus.selectors.js, focus.service.js, and state/ files,
 * but BEFORE script.js.
 */
(function () {
  'use strict';

  window.FocusController = {

    // ── Timer Controls ────────────────────────────────────────

    onStart:  function () { window.FocusService.start(); },
    onPause:  function () { window.FocusService.pause(); },
    onResume: function () { window.FocusService.resume(); },
    onStop:   function () { window.FocusService.stop(); },
    onReset:  function () { window.FocusService.reset(); },

    // ── Mode & Configuration ──────────────────────────────────

    onSwitchMode: function (mode) {
      window.FocusService.switchMode(mode);
    },

    onSetPomodoroDuration: function (mins) {
      window.FocusService.setPomodoroDuration(mins);
    },

    onSetPomodoroBreak: function (mins) {
      window.FocusService.setPomodoroBreak(mins);
    },

    onSetPomodoroSessions: function (count) {
      window.FocusService.setPomodoroSessions(count);
    },

    // ── Audio ─────────────────────────────────────────────────

    onSelectTrack: function (trackId) {
      window.FocusService.selectTrack(trackId);
    },

    onToggleAudio: function () {
      window.FocusService.toggleAudio();
    },

    onSetVolume: function (vol) {
      window.FocusService.setVolume(vol);
    },

    onToggleFocusMode: function () {
      window.FocusService.toggleFocusMode();
    },

    // ── Read Operations ───────────────────────────────────────

    getAllSessions:  function () { return window.FocusSelectors.getAllSessions(); },
    getTodayMinutes: function () { return window.FocusSelectors.getTodayMinutes(); },
    getSessionCount: function () { return window.FocusSelectors.getSessionCount(); }
  };

})();

/**
 * ============================================================================
 * state/eventBus.js — Lightweight Publish / Subscribe
 * ============================================================================
 *
 * Decouples state mutations from DOM rendering.
 * Services publish domain events; View modules subscribe and re-render.
 *
 * Canonical event names:
 *   STATE_UPDATED:tasks
 *   STATE_UPDATED:meals
 *   STATE_UPDATED:workouts
 *   STATE_UPDATED:notes
 *   STATE_UPDATED:focus
 *   STATE_UPDATED:projects
 *   STATE_UPDATED:streaks
 *   STATE_UPDATED:profile
 *   STATE_UPDATED:calendar
 *   PAGE_SHOWN
 *
 * RULES:
 *   - Does NOT mutate any state.
 *   - Does NOT touch the DOM.
 *   - Subscribers receive (eventName, payload).
 *
 * Loaded BEFORE hydration.js and any feature module.
 */
(function () {
  'use strict';

  var _listeners = {};

  window.EventBus = {
    /**
     * Register a callback for an event.
     * @param {string} event
     * @param {Function} callback — fn(data)
     * @returns {Function} unsubscribe handle
     */
    subscribe: function subscribe(event, callback) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(callback);
      return function unsubscribe() {
        _listeners[event] = (_listeners[event] || []).filter(function (cb) {
          return cb !== callback;
        });
      };
    },

    /**
     * Emit an event to all registered listeners.
     * @param {string} event
     * @param {*} [data]
     */
    publish: function publish(event, data) {
      var cbs = _listeners[event];
      if (!cbs || !cbs.length) return;
      for (var i = 0; i < cbs.length; i++) {
        try {
          cbs[i](data);
        } catch (err) {
          console.error('[EventBus] Error in subscriber for "' + event + '":', err);
        }
      }
    },

    /**
     * Subscribe to an event but auto-unsubscribe after the first firing.
     * @param {string} event
     * @param {Function} callback
     * @returns {Function} unsubscribe handle
     */
    once: function once(event, callback) {
      var unsub = this.subscribe(event, function (data) {
        unsub();
        callback(data);
      });
      return unsub;
    },

    /**
     * Remove ALL listeners for an event (or all events if no arg).
     * Useful for testing / cleanup.
     * @param {string} [event]
     */
    clear: function clear(event) {
      if (event) {
        delete _listeners[event];
      } else {
        _listeners = {};
      }
    }
  };

})();

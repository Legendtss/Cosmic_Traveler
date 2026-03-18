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
  var MAX_LISTENERS_PER_EVENT = 200;

  window.EventBus = {
    /**
     * Register a callback for an event.
     * @param {string} event
     * @param {Function} callback — fn(data)
     * @returns {Function} unsubscribe handle
     */
    subscribe: function subscribe(event, callback) {
      if (typeof callback !== 'function') {
        console.warn('[EventBus] subscribe ignored for "' + event + '" (callback is not a function)');
        return function noop() {};
      }
      if (!_listeners[event]) _listeners[event] = [];
      // Avoid duplicate registrations of the same callback, a common source
      // of long-session leaks when init hooks run multiple times.
      if (_listeners[event].indexOf(callback) !== -1) {
        return function unsubscribe() {
          _listeners[event] = (_listeners[event] || []).filter(function (cb) {
            return cb !== callback;
          });
        };
      }
      if (_listeners[event].length >= MAX_LISTENERS_PER_EVENT) {
        console.warn('[EventBus] listener cap reached for "' + event + '" (' + MAX_LISTENERS_PER_EVENT + ')');
        return function noop() {};
      }
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
      // Snapshot before iterating to avoid mutation side effects.
      var snapshot = cbs.slice();
      for (var i = 0; i < snapshot.length; i++) {
        try {
          snapshot[i](data);
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
    },

    /**
     * Introspection helper for diagnostics and leak detection.
     * @param {string} [event]
     * @returns {number}
     */
    listenerCount: function listenerCount(event) {
      if (event) return (_listeners[event] || []).length;
      return Object.keys(_listeners).reduce(function (sum, key) {
        return sum + ((_listeners[key] || []).length);
      }, 0);
    }
  };

})();

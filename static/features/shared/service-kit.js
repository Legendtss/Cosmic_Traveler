/**
 * Shared helpers for feature service modules.
 */
(function () {
  'use strict';

  if (window.FeatureServiceKit) return;

  var _warned = new Set();

  function _warn(feature, message) {
    var key = feature + '|' + message;
    if (_warned.has(key)) return;
    _warned.add(key);
    console.error('[' + feature + '] ' + message);
    if (typeof showToast === 'function') {
      showToast(message, 'warning', { title: feature, duration: 4500 });
    }
  }

  function _resolveGlobalFn(name) {
    var fn = window[name];
    return typeof fn === 'function' ? fn : null;
  }

  function invoke(name, args, options) {
    options = options || {};
    var feature = options.feature || 'FeatureService';
    var fn = _resolveGlobalFn(name);
    if (!fn) {
      _warn(feature, 'Dependency "' + name + '" is not loaded yet.');
      if (options.throwOnMissing) {
        throw new Error('Missing dependency: ' + name);
      }
      return options.fallback;
    }
    return fn.apply(window, Array.isArray(args) ? args : []);
  }

  function createDedup(options) {
    options = options || {};
    var windowMs = Number(options.windowMs || 2000);
    var maxEntries = Number(options.maxEntries || 120);
    var namespace = String(options.namespace || 'feature');
    var ops = new Map();

    return function dedup(key) {
      var opKey = namespace + ':' + String(key || '');
      var now = Date.now();
      var last = ops.get(opKey);
      if (last && (now - last) < windowMs) return true;
      ops.set(opKey, now);
      if (ops.size > maxEntries) {
        var cutoff = now - (windowMs * 5);
        ops.forEach(function (ts, k) {
          if (ts < cutoff) ops.delete(k);
        });
      }
      return false;
    };
  }

  function createJsonDedup(options) {
    var check = createDedup(options || {});
    return function jsonDedup(payload) {
      var key;
      try {
        key = JSON.stringify(payload);
      } catch (_err) {
        key = String(Date.now());
      }
      return check(key);
    };
  }

  window.FeatureServiceKit = {
    invoke: invoke,
    createDedup: createDedup,
    createJsonDedup: createJsonDedup
  };
})();

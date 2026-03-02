/**
 * ============================================================================
 * state/apiClient.js — Centralized HTTP Client
 * ============================================================================
 *
 * Single point of entry for ALL backend API calls.
 * Handles base URL, JSON headers, error normalization, and demo-mode bypass.
 *
 * RULES:
 *   - Does NOT mutate AppState.
 *   - Does NOT touch the DOM.
 *   - All methods return { ok, data, status, error }.
 *   - Consumers never call raw fetch() directly.
 *
 * Loaded BEFORE any feature service or script.js.
 */
(function () {
  'use strict';

  var BASE = '/api';

  /**
   * Core request dispatcher.
   *
   * @param {string} endpoint — e.g. '/tasks' or '/meals/42'
   * @param {Object}  opts
   * @param {string}  opts.method   — HTTP verb (default GET)
   * @param {Object}  [opts.body]   — JSON-serializable body
   * @param {Object}  [opts.params] — URL query parameters
   * @returns {Promise<{ok: boolean, data: *, status: number, error: string|null}>}
   */
  async function request(endpoint, opts) {
    opts = opts || {};
    var method = (opts.method || 'GET').toUpperCase();
    var url = BASE + endpoint;

    // Append query params
    if (opts.params) {
      var qs = Object.keys(opts.params)
        .filter(function (k) { return opts.params[k] != null; })
        .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(opts.params[k]); })
        .join('&');
      if (qs) url += '?' + qs;
    }

    var fetchOpts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };

    if (opts.body && method !== 'GET') {
      fetchOpts.body = JSON.stringify(opts.body);
    }

    try {
      var res = await fetch(url, fetchOpts);
      var data = null;
      var text = await res.text();
      try { data = JSON.parse(text); } catch (_) { data = text; }

      if (!res.ok) {
        var errMsg = (data && data.error) || ('HTTP ' + res.status);
        console.error('[ApiClient] ' + method + ' ' + url + ' → ' + res.status, errMsg);
        return { ok: false, data: data, status: res.status, error: errMsg };
      }

      return { ok: true, data: data, status: res.status, error: null };
    } catch (err) {
      console.error('[ApiClient] Network error:', method, url, err);
      return { ok: false, data: null, status: 0, error: err.message || 'Network error' };
    }
  }

  // ── Convenience Methods ────────────────────────────────────

  window.ApiClient = {
    /**
     * GET request.
     * @param {string} endpoint
     * @param {Object} [params] — query params
     */
    get: function (endpoint, params) {
      return request(endpoint, { method: 'GET', params: params });
    },

    /**
     * POST request.
     * @param {string} endpoint
     * @param {Object} body
     */
    post: function (endpoint, body) {
      return request(endpoint, { method: 'POST', body: body });
    },

    /**
     * PUT request.
     * @param {string} endpoint
     * @param {Object} body
     */
    put: function (endpoint, body) {
      return request(endpoint, { method: 'PUT', body: body });
    },

    /**
     * PATCH request.
     * @param {string} endpoint
     * @param {Object} body
     */
    patch: function (endpoint, body) {
      return request(endpoint, { method: 'PATCH', body: body });
    },

    /**
     * DELETE request.
     * @param {string} endpoint
     * @param {Object} [body]
     */
    delete: function (endpoint, body) {
      return request(endpoint, { method: 'DELETE', body: body });
    },

    /**
     * Raw request (full control).
     * @param {string} endpoint
     * @param {Object} opts
     */
    request: request
  };

})();

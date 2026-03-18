/**
 * FILE: state/offlineQueue.js - Client-side offline mutation queue
 */
(function () {
  'use strict';

  const QUEUE_KEY = 'ft_offline_queue_v1';
  const MAX_QUEUE_ITEMS = 250;
  const NEVER_QUEUE = ['/api/ai/', '/api/auth/'];
  const TRANSIENT_STATUS = new Set([408, 425, 429]);

  let _memoryQueue = [];
  let _warnedPersistenceFailure = false;
  let _originalFetch;
  let _banner = null;

  const OFFLINE_DEBUG = (function () {
    try {
      if (typeof window.__FT_DEBUG__ === 'boolean') return window.__FT_DEBUG__;
      const stored = localStorage.getItem('ft_debug');
      if (stored !== null) {
        const normalized = String(stored).trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
      }
    } catch (_err) {}
    const host = (window.location && window.location.hostname) || '';
    return host === 'localhost' || host === '127.0.0.1';
  })();

  function _debugLog() {
    if (OFFLINE_DEBUG) console.log.apply(console, arguments);
  }

  function _debugWarn() {
    if (OFFLINE_DEBUG) console.warn.apply(console, arguments);
  }

  function _safeParseJson(raw) {
    if (!raw || typeof raw !== 'string') return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function _normalizeHeaders(headers) {
    if (!headers) return {};
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      const out = {};
      headers.forEach(function (value, key) {
        out[key] = value;
      });
      return out;
    }
    if (Array.isArray(headers)) {
      const fromPairs = {};
      for (let i = 0; i < headers.length; i++) {
        const pair = headers[i];
        if (Array.isArray(pair) && pair.length >= 2) fromPairs[String(pair[0])] = String(pair[1]);
      }
      return fromPairs;
    }
    if (typeof headers === 'object') return Object.assign({}, headers);
    return {};
  }

  function _loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return _memoryQueue.slice();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return _memoryQueue.slice();
    }
  }

  function _saveQueue(queue) {
    const bounded = Array.isArray(queue) ? queue.slice(-MAX_QUEUE_ITEMS) : [];
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(bounded));
      _memoryQueue = bounded.slice();
      _warnedPersistenceFailure = false;
      return true;
    } catch (_err) {
      try {
        const trimmed = bounded.slice(-Math.min(50, MAX_QUEUE_ITEMS));
        localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
        _memoryQueue = trimmed.slice();
        _warnedPersistenceFailure = false;
        return true;
      } catch (_err2) {
        _memoryQueue = bounded.slice();
        if (!_warnedPersistenceFailure) {
          _warnedPersistenceFailure = true;
          _toast(
            'Offline queue storage is full. Pending changes are kept in memory for this tab only.',
            'warning',
            { title: 'Storage Limit', duration: 6500 }
          );
          _debugWarn('[OfflineQueue] localStorage write failed; using in-memory fallback');
        }
        return false;
      }
    }
  }

  function _extractTaskIdFromUrl(url) {
    if (typeof url !== 'string') return null;
    const match = url.match(/^\/api\/tasks\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function _isTaskCreate(item) {
    return !!(item && item.method === 'POST' && typeof item.url === 'string' && item.url.indexOf('/api/tasks') === 0 && !/\/api\/tasks\/[^/?#]+/.test(item.url));
  }

  function _findQueuedTaskCreate(queue, tempTaskId) {
    if (!tempTaskId) return null;
    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      if (_isTaskCreate(item) && item.meta && item.meta.tempTaskId === tempTaskId) {
        return item;
      }
    }
    return null;
  }

  function _coalesceTempTaskMutation(queue, url, options) {
    const taskId = _extractTaskIdFromUrl(url);
    if (!taskId || taskId.indexOf('offline_') !== 0) return false;
    const createItem = _findQueuedTaskCreate(queue, taskId);
    if (!createItem) return false;

    const method = String(options.method || 'POST').toUpperCase();
    const createPayload = _safeParseJson(createItem.body) || {};
    const mutationPayload = _safeParseJson(options.body) || {};

    if (/\/toggle(?:$|\?)/.test(url) && method === 'PATCH') {
      createPayload.completed = !Boolean(createPayload.completed);
      createItem.body = JSON.stringify(createPayload);
      return true;
    }

    if ((method === 'PUT' || method === 'PATCH') && /^\/api\/tasks\/[^/?#]+(?:$|\?)/.test(url)) {
      Object.assign(createPayload, mutationPayload);
      createItem.body = JSON.stringify(createPayload);
      return true;
    }

    if (method === 'DELETE' && /^\/api\/tasks\/[^/?#]+(?:$|\?)/.test(url)) {
      const idx = queue.indexOf(createItem);
      if (idx !== -1) queue.splice(idx, 1);
      return true;
    }

    return false;
  }

  function _enqueue(url, options) {
    const queue = _loadQueue();
    if (_coalesceTempTaskMutation(queue, url, options)) {
      _saveQueue(queue);
      _refreshBadge();
      return { queued: true, coalesced: true };
    }

    const method = String(options.method || 'POST').toUpperCase();
    const queuedItem = {
      id: 'q' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      url: url,
      method: method,
      body: options.body || null,
      headers: _normalizeHeaders(options.headers),
      ts: new Date().toISOString(),
      meta: {}
    };

    if (_isTaskCreate(queuedItem)) {
      queuedItem.meta.tempTaskId = 'offline_' + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    queue.push(queuedItem);
    _saveQueue(queue);
    _refreshBadge();
    return queuedItem;
  }

  function _replaceQueuedTaskTempId(value, idMap) {
    if (typeof value !== 'string') return value;
    let out = value;
    for (const tempId in idMap) {
      if (!Object.prototype.hasOwnProperty.call(idMap, tempId)) continue;
      const realId = String(idMap[tempId]);
      out = out.replace(new RegExp('/api/tasks/' + tempId + '(?=/|$|\\?)', 'g'), '/api/tasks/' + realId);
      out = out.replace(new RegExp('"' + tempId + '"', 'g'), '"' + realId + '"');
    }
    return out;
  }

  function _shouldRetryStatus(status) {
    return status >= 500 || TRANSIENT_STATUS.has(status);
  }

  async function _flush() {
    const queue = _loadQueue();
    if (!queue.length) return 0;

    const failures = [];
    const tempTaskIdMap = {};
    let synced = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      const requestUrl = _replaceQueuedTaskTempId(item.url, tempTaskIdMap);
      const requestBody = _replaceQueuedTaskTempId(item.body, tempTaskIdMap);

      try {
        const res = await _originalFetch(requestUrl, {
          method: item.method,
          credentials: 'same-origin',
          headers: Object.assign({ 'Content-Type': 'application/json' }, _normalizeHeaders(item.headers)),
          body: requestBody
        });

        if (res.ok) {
          synced++;
          if (_isTaskCreate(item) && item.meta && item.meta.tempTaskId) {
            const payload = await res.clone().json().catch(function () { return null; });
            if (payload && payload.id != null) {
              tempTaskIdMap[item.meta.tempTaskId] = payload.id;
            }
          }
        } else if (_shouldRetryStatus(res.status)) {
          failures.push(item);
          _debugWarn('[OfflineQueue] Keeping item for retry; status', res.status, item.url);
        } else {
          _debugWarn('[OfflineQueue] Dropping item; non-retryable status', res.status, item.url);
        }
      } catch (_networkErr) {
        failures.push(item);
      }
    }

    _saveQueue(failures);
    _refreshBadge();
    return synced;
  }

  function _patchFetch() {
    _originalFetch = window.fetch;

    window.fetch = async function patchedFetch(url, options) {
      options = options || {};
      const method = String(options.method || 'GET').toUpperCase();
      const isMutation = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
      const isSameOriginApi = (
        typeof url === 'string' &&
        url.indexOf('/api/') === 0 &&
        !NEVER_QUEUE.some(function (prefix) { return url.indexOf(prefix) === 0; })
      );

      if (!isMutation || !isSameOriginApi) return _originalFetch(url, options);

      if (!navigator.onLine) {
        const queuedItem = _enqueue(url, options);
        _notifyQueued(url);
        return _buildQueuedResponse(url, queuedItem);
      }

      try {
        return await _originalFetch(url, options);
      } catch (err) {
        if (err instanceof TypeError) {
          const queuedItem = _enqueue(url, options);
          _notifyQueued(url);
          return _buildQueuedResponse(url, queuedItem);
        }
        throw err;
      }
    };
  }

  function _buildQueuedResponse(url, queuedItem) {
    const tempId = (queuedItem && queuedItem.meta && queuedItem.meta.tempTaskId) || ('offline_' + Date.now());
    let body;

    if (typeof url === 'string' && url.indexOf('/api/tasks') === 0 && !url.includes('/toggle') && !/\/api\/tasks\/[^/?#]+/.test(url)) {
      body = { id: tempId, title: '', completed: false, queued: true };
    } else {
      body = { ok: true, queued: true, id: tempId };
    }

    return new Response(JSON.stringify(body), {
      status: 202,
      headers: { 'Content-Type': 'application/json', 'X-Queued': '1' }
    });
  }

  function _createBanner() {
    _banner = document.createElement('div');
    _banner.id = 'offline-banner';
    _banner.className = 'offline-banner';
    _banner.setAttribute('role', 'status');
    _banner.setAttribute('aria-live', 'polite');
    _banner.innerHTML = [
      '<span class="offline-banner-icon"><i class="fas fa-wifi" aria-hidden="true"></i></span>',
      '<span class="offline-banner-msg">You are offline - changes will sync automatically when you reconnect</span>',
      '<span class="offline-banner-badge" id="offline-queue-badge"></span>'
    ].join('');
    document.body.appendChild(_banner);
  }

  function _showBanner() {
    if (_banner) _banner.classList.add('is-visible');
  }

  function _hideBanner() {
    if (_banner) _banner.classList.remove('is-visible');
  }

  function _refreshBadge() {
    const badge = document.getElementById('offline-queue-badge');
    if (!badge) return;
    const count = _loadQueue().length;
    badge.textContent = count > 0 ? String(count) + ' pending' : '';
    badge.classList.toggle('has-items', count > 0);
  }

  function _toast(message, type, opts) {
    if (typeof showToast === 'function') {
      showToast(message, type, opts);
    } else {
      _debugLog('[OfflineQueue]', message);
    }
  }

  function _labelForUrl(url) {
    if (!url || typeof url !== 'string') return 'Change';
    if (url.indexOf('/tasks') !== -1) return 'Task update';
    if (url.indexOf('/meals') !== -1) return 'Meal log';
    if (url.indexOf('/workouts') !== -1) return 'Workout log';
    if (url.indexOf('/notes') !== -1) return 'Note';
    if (url.indexOf('/projects') !== -1) return 'Project update';
    if (url.indexOf('/streaks') !== -1) return 'Streak update';
    return 'Change';
  }

  function _notifyQueued(url) {
    _refreshBadge();
    _toast(
      '"' + _labelForUrl(url) + '" saved offline - will sync when you reconnect',
      'warning',
      { title: 'Offline', duration: 5500 }
    );
  }

  async function _handleOnline() {
    await new Promise(function (resolve) { setTimeout(resolve, 1200); });
    const synced = await _flush();
    _hideBanner();

    if (synced > 0) {
      _toast(
        'Synced ' + synced + ' offline ' + (synced === 1 ? 'change' : 'changes') + ' successfully',
        'success',
        { title: 'Back Online' }
      );
      setTimeout(function () {
        if (typeof loadActiveUserDataViews === 'function') loadActiveUserDataViews();
      }, 900);
      return;
    }

    _toast('You are back online', 'info', { duration: 3000 });
  }

  function init() {
    _createBanner();
    _patchFetch();
    _refreshBadge();

    if (!navigator.onLine) _showBanner();

    window.addEventListener('offline', function () {
      _showBanner();
    });

    window.addEventListener('online', function () {
      _handleOnline();
    });
  }

  window.OfflineQueue = { init: init };
})();

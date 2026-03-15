/**
 * FILE: state/offlineQueue.js — Client-Side Offline Mutation Queue
 * ──────────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Detect online/offline status and show/hide a banner.
 *   2. Patch window.fetch so that same-origin API mutations
 *      (POST / PUT / PATCH / DELETE to /api/*) are:
 *        • Queued in localStorage when the browser is offline.
 *        • Returned as a 202 "queued" response so existing code
 *          that checks `response.ok` doesn't error out.
 *   3. When connectivity is restored, flush the queue in order,
 *      then trigger a data-view refresh.
 *
 * MUST NOT:
 *   - Be loaded before script.js (showToast / loadActiveUserDataViews
 *     are expected to be globals defined there).
 *   - Queue AI endpoints — AI responses are not replayable.
 *   - Queue GET requests — those are handled by the service worker.
 *
 * Initialisation:
 *   Called via  OfflineQueue.init()  in the DOMContentLoaded handler
 *   added by index.html after this file loads.
 */
(function () {
  'use strict';

  // ── Constants ───────────────────────────────────────────────
  const QUEUE_KEY = 'ft_offline_queue_v1';

  // Paths we intentionally never queue (AI round-trips, auth flows)
  const NEVER_QUEUE = ['/api/ai/', '/api/auth/'];

  const OFFLINE_DEBUG = (() => {
    try {
      if (typeof window.__FT_DEBUG__ === 'boolean') return window.__FT_DEBUG__;
      const stored = localStorage.getItem('ft_debug');
      if (stored !== null) {
        return ['1', 'true', 'yes', 'on'].includes(String(stored).trim().toLowerCase());
      }
    } catch (_err) {
      // fall through
    }

    const host = (window.location && window.location.hostname) || '';
    return host === 'localhost' || host === '127.0.0.1';
  })();

  function _debugLog(...args) {
    if (OFFLINE_DEBUG) console.log(...args);
  }

  function _debugWarn(...args) {
    if (OFFLINE_DEBUG) console.warn(...args);
  }

  // ── Queue helpers (localStorage) ───────────────────────────
  function _loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function _saveQueue(queue) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (_) {
      // Quota exceeded — drop oldest item and retry once
      try {
        const trimmed = queue.slice(-20);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
      } catch (_) { /* silent */ }
    }
  }

  function _enqueue(url, options) {
    const queue = _loadQueue();
    queue.push({
      id:      `q${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url:     url,
      method:  (options.method || 'POST').toUpperCase(),
      body:    options.body  || null,
      headers: options.headers || {},
      ts:      new Date().toISOString(),
    });
    _saveQueue(queue);
    _refreshBadge();
  }

  // ── Flush queue on reconnect ────────────────────────────────
  async function _flush() {
    const queue = _loadQueue();
    if (!queue.length) return 0;

    const failures = [];
    let synced = 0;

    for (const item of queue) {
      try {
        const res = await _originalFetch(item.url, {
          method:      item.method,
          credentials: 'same-origin',
          headers:     Object.assign({ 'Content-Type': 'application/json' }, item.headers),
          body:        item.body,
        });
        if (res.ok) {
          synced++;
        } else {
          // 4xx means the action is permanently invalid (e.g. deleted resource);
          // drop it so we don't loop forever.
          _debugWarn('[OfflineQueue] Dropping item - server returned', res.status, item.url);
        }
      } catch (_networkErr) {
        // Still offline — keep for next attempt
        failures.push(item);
      }
    }

    _saveQueue(failures);
    _refreshBadge();
    return synced;
  }

  // ── Fetch patch ─────────────────────────────────────────────
  let _originalFetch;

  function _patchFetch() {
    _originalFetch = window.fetch;

    window.fetch = async function patchedFetch(url, options) {
      options = options || {};
      const method = (options.method || 'GET').toUpperCase();
      const isMutation  = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const isSameOriginApi = (
        typeof url === 'string' &&
        url.startsWith('/api/') &&
        !NEVER_QUEUE.some((prefix) => url.startsWith(prefix))
      );

      // Only intercept same-origin API mutations
      if (!isMutation || !isSameOriginApi) {
        return _originalFetch(url, options);
      }

      // ── Already offline: queue immediately ─────────────────
      if (!navigator.onLine) {
        _enqueue(url, options);
        _notifyQueued(url);
        return _buildQueuedResponse(url);
      }

      // ── Online: attempt the real call ──────────────────────
      try {
        return await _originalFetch(url, options);
      } catch (err) {
        // TypeError = network unreachable (server down, no connection)
        if (err instanceof TypeError) {
          _enqueue(url, options);
          _notifyQueued(url);
          return _buildQueuedResponse(url);
        }
        throw err; // Re-throw unexpected errors unchanged
      }
    };
  }

  /**
   * Build a response that `response.ok` callers consider successful.
   * The body is shaped to avoid crashing code that reads specific fields
   * (e.g. addTask() reads createdTask.id).
   */
  function _buildQueuedResponse(url) {
    const tempId = `offline_${Date.now()}`;
    let body;

    if (url.startsWith('/api/tasks') && !url.includes('/toggle') && !url.match(/\/\d+$/)) {
      // Task creation — return a minimal task skeleton
      body = { id: tempId, title: '', completed: false, queued: true };
    } else {
      body = { ok: true, queued: true, id: tempId };
    }

    return new Response(JSON.stringify(body), {
      status:  202,
      headers: { 'Content-Type': 'application/json', 'X-Queued': '1' },
    });
  }

  // ── Banner ──────────────────────────────────────────────────
  let _banner = null;

  function _createBanner() {
    _banner = document.createElement('div');
    _banner.id        = 'offline-banner';
    _banner.className = 'offline-banner';
    _banner.setAttribute('role', 'status');
    _banner.setAttribute('aria-live', 'polite');
    _banner.innerHTML = [
      '<span class="offline-banner-icon"><i class="fas fa-wifi" aria-hidden="true"></i></span>',
      '<span class="offline-banner-msg">You\'re offline — changes will sync automatically when you reconnect</span>',
      '<span class="offline-banner-badge" id="offline-queue-badge"></span>',
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
    badge.textContent = count > 0 ? `${count} pending` : '';
    badge.classList.toggle('has-items', count > 0);
  }

  // ── Toasts ──────────────────────────────────────────────────
  function _toast(message, type, opts) {
    if (typeof showToast === 'function') {
      showToast(message, type, opts);
    } else {
      _debugLog('[OfflineQueue]', message);
    }
  }

  function _notifyQueued(url) {
    _refreshBadge();
    const label = _labelForUrl(url);
    _toast(
      `"${label}" saved offline — will sync when you reconnect`,
      'warning',
      { title: 'Offline', duration: 5500 }
    );
  }

  function _labelForUrl(url) {
    if (url.includes('/tasks'))     return 'Task update';
    if (url.includes('/meals'))     return 'Meal log';
    if (url.includes('/workouts'))  return 'Workout log';
    if (url.includes('/notes'))     return 'Note';
    if (url.includes('/projects'))  return 'Project update';
    if (url.includes('/streaks'))   return 'Streak update';
    return 'Change';
  }

  // ── Reconnect handler ───────────────────────────────────────
  async function _handleOnline() {
    // Small delay to let the network settle before flushing
    await new Promise((r) => setTimeout(r, 1200));

    const synced = await _flush();
    _hideBanner();

    if (synced > 0) {
      _toast(
        `Synced ${synced} offline ${synced === 1 ? 'change' : 'changes'} successfully`,
        'success',
        { title: 'Back Online' }
      );
      // Brief delay so toasts are readable before data refreshes
      setTimeout(() => {
        if (typeof loadActiveUserDataViews === 'function') {
          loadActiveUserDataViews();
        }
      }, 900);
    } else {
      _toast("You're back online", 'info', { duration: 3000 });
    }
  }

  // ── Public API ───────────────────────────────────────────────
  function init() {
    _createBanner();
    _patchFetch();
    _refreshBadge();

    // Reflect current status on boot (e.g. user loads page while offline)
    if (!navigator.onLine) _showBanner();

    window.addEventListener('offline', () => {
      _showBanner();
    });

    window.addEventListener('online', () => {
      _handleOnline();
    });
  }

  window.OfflineQueue = { init: init };
})();

/**
 * FILE: sw.js — FitTrack Pro Service Worker
 * ──────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. Pre-cache the app shell so it loads instantly (even during
 *      Render cold-starts which can take 10-30 s).
 *   2. Stale-while-revalidate for all static assets (JS, CSS, fonts).
 *   3. Network-first with stale fallback for API GET endpoints so
 *      last-seen data is visible even when offline.
 *   4. Passthrough for API mutations — client-side OfflineQueue
 *      handles queuing and replay (see state/offlineQueue.js).
 *
 * Cache names are versioned.  Bumping VER prunes all old caches
 * on the next activate cycle.
 */
'use strict';

const VER         = '2';
const SHELL_CACHE = `ft-shell-v${VER}`;
const DATA_CACHE  = `ft-data-v${VER}`;

// ── Core shell assets to pre-cache on install ─────────────────
// Keep this list small — only what is needed to render the UI
// skeleton before the network responds.
const SHELL_FILES = [
  '/',
  '/styles.css',
  '/css/00-auth.css',
  '/css/01-onboarding.css',
  '/manifest.json',
  '/app-icon.svg',
  '/app-icon-maskable.svg',
  '/js/00-auth.js',
  '/state/offlineQueue.js',
  '/script.js',
];

// ────────────────────────────────────────────────────────────────
// Install — pre-cache shell
// ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      // skipWaiting so the new SW activates immediately without
      // waiting for old tabs to close.
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Partial pre-cache failure (e.g. a 404 on one file) must not
        // abort the whole install.  Log and continue.
        console.warn('[SW] Pre-cache partial failure:', err);
      })
  );
});

// ────────────────────────────────────────────────────────────────
// Activate — prune stale caches
// ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ft-') && !keep.has(k))
            .map((k) => {
              return caches.delete(k);
            })
        )
      )
      // claim() so this SW controls all open tabs immediately without reload.
      .then(() => self.clients.claim())
  );
});

// ────────────────────────────────────────────────────────────────
// Fetch — routing table
// ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Skip cross-origin requests (CDN scripts, Google Fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // 2. Skip non-GET API mutations — let them reach the network
  //    normally.  OfflineQueue intercepts them on the client side.
  if (url.pathname.startsWith('/api/') && req.method !== 'GET') return;

  // 3. API GET endpoints — network-first, serve stale on failure
  if (url.pathname.startsWith('/api/') && req.method === 'GET') {
    event.respondWith(_networkFirstWithFallback(req, DATA_CACHE));
    return;
  }

  // 4. HTML navigation — always serve the cached shell so the app
  //    is available offline even before /api/ calls succeed.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((cached) => cached || fetch(req))
    );
    return;
  }

  // 5. All other static assets (JS, CSS, images, fonts) — serve
  //    from cache immediately, then refresh in the background.
  event.respondWith(_staleWhileRevalidate(req, SHELL_CACHE));
});

// ────────────────────────────────────────────────────────────────
// Strategy helpers
// ────────────────────────────────────────────────────────────────

/**
 * Network-first: attempt network, cache success, return stale on failure.
 * For API GET responses we also return a clean offline JSON if no cache exists.
 */
async function _networkFirstWithFallback(request, cacheName) {
  const cache  = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // Only cache successful responses to avoid poisoning the cache with
    // 4xx/5xx from the server.
    if (response && response.ok) {
      cache.put(request, response.clone()); // async, intentionally not awaited
    }
    return response;
  } catch (_networkError) {
    const cached = await cache.match(request);
    if (cached) return cached;

    // No cache either — return a minimal offline sentinel so callers
    // receive a parseable JSON response without throwing.
    return new Response(
      JSON.stringify({ ok: false, error: 'offline', data: [], stale: false }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-SW-Offline': '1',
        },
      }
    );
  }
}

/**
 * Stale-while-revalidate: return cached copy instantly if available,
 * then update the cache from the network in the background.
 * Falls back to a network fetch if nothing is cached yet.
 */
async function _staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Kick off network refresh regardless (fire-and-forget)
  const networkFetch = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  // Serve cached version immediately; if nothing cached yet, wait for network
  return cached || (await networkFetch) || new Response('', { status: 503 });
}

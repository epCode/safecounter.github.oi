// Bump this string whenever you deploy — it forces the old SW out immediately.
// Easiest approach: just match your deploy date/version, e.g. 'safe-counter-2025-05-19'
const CACHE_NAME = 'safe-counter-v2';
const BASE_PATH = '/safecounter.github.oi';

const PRECACHE_URLS = [
  BASE_PATH + '/index.html',
  BASE_PATH + '/manifest.json'
];

// ── Install: precache known assets, then take over immediately ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // don't wait for old SW to die
  );
});

// ── Activate: delete every cache that isn't ours, then claim all clients ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.map(name => name !== CACHE_NAME && caches.delete(name))
      ))
      .then(() => self.clients.claim()) // take over open tabs immediately
  );
});

// ── Fetch strategy ──
// HTML pages  → network-first (always try to get the freshest version;
//               fall back to cache only when offline)
// Everything else → cache-first (fast; network updates cache in background)
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isHTML = request.destination === 'document' ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === BASE_PATH + '/';

  if (isHTML) {
    // Network-first: fresh page every time, cache as offline fallback
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // Cache-first with background revalidation (stale-while-revalidate)
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
          return cached || networkFetch;
        })
      )
    );
  }
});

// ── Tell all open clients to reload when this SW activates ──
// index.html listens for this message and calls location.reload()
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

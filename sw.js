/**
 * Service Worker for forms-launcher PWA (v8)
 * Caches ONLY same-origin App Shell assets for fast offline startup.
 * 
 * Rules:
 * 1. Must NOT handle any cross-origin requests (Supabase, Google Forms, fonts, CDNs).
 * 2. Navigations to /admin and /admin.html always go directly to network (no caching, no offline fallback).
 * 3. /api/* serverless endpoints always go directly to network.
 * 4. skipWaiting and clients.claim ensure immediate activation across all tabs/installs.
 */

const CACHE_NAME = 'forms-launcher-pwa-v8';

// Same-origin App Shell assets ONLY
const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.svg'
];

// Install: Cache local static assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Delete all previous caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW v6] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Same-origin App Shell requests ONLY
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. MUST NOT handle any cross-origin requests (Supabase, Google, fonts, CDNs)
  // Only same-origin requests are handled
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. Navigations and requests to /admin and /admin.html must always go to the network
  // with NO caching and NO offline fallback
  if (
    url.pathname === '/admin' ||
    url.pathname.startsWith('/admin') ||
    url.pathname === '/js/admin.js'
  ) {
    return;
  }

  // 4. API endpoints (/api/*) must always go directly to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 5. Same-origin App Shell: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and navigating to user app shell, serve cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// 2026 Progressive Web App Service Worker for محراب القرآن
const CACHE_NAME = 'mihrab-quran-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('Pre-cache asset note:', asset, err);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests, browser extensions, APIs, media streaming, and AI endpoints
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    request.destination === 'audio' ||
    request.destination === 'video' ||
    request.headers.has('range') ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('everyayah.com') ||
    url.hostname.includes('mp3quran.net') ||
    url.hostname.includes('quranenc.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  // Network-First for HTML navigations
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) =>
            cached || caches.match('/').then((rootCached) =>
              rootCached || new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>غير متصل</title><body><p>التطبيق غير متصل بالإنترنت حالياً.</p></body></html>', {
                status: 503,
                statusText: 'Offline',
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
              })
            )
          );
        })
    );
    return;
  }

  // Cache-First for static assets (images, fonts, icons)
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => new Response('', { status: 503, statusText: 'Offline' }));
      })
    );
    return;
  }

  // Stale-While-Revalidate for other static requests (safe offline fallback)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(
          () =>
            new Response('{"error":"offline"}', {
              status: 503,
              statusText: 'Offline',
              headers: { 'Content-Type': 'application/json' },
            })
        );
    })
  );
});

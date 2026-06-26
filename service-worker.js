// Service worker v99 — limpa TODOS os caches e não cacheia HTML
const CACHE_NAME = 'copa2026-v99';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Nunca servir do cache — sempre buscar da rede
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

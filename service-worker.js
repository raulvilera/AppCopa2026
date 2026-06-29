// Service Worker v100 — cache mínimo para instalação PWA
const CACHE_NAME = 'copa2026-v100';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/api/icon-192.png',
  '/api/icon-512.png',
  '/api/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Sempre busca da rede primeiro; fallback para cache se offline
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

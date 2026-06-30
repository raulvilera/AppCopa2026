// service-worker.js — Copa do Mundo 2026
// Estratégia: network-first (sempre tenta buscar a versão mais nova;
// só usa cache se estiver offline). skipWaiting + clients.claim garantem
// que toda nova versão publicada assume o controle imediatamente.

const CACHE_VERSION = 'copa2026-v' + Date.now(); // muda a cada deploy
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
];

// ── INSTALL ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting(); // ativa o novo SW imediatamente, sem esperar abas fecharem
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// ── ACTIVATE ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key)) // apaga caches de versões antigas
      )
    ).then(() => self.clients.claim()) // assume controle de todas as abas abertas
  );
});

// ── FETCH (network-first) ────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Não interceptar chamadas de API (sempre precisam ser ao vivo)
  if (request.url.includes('/api/')) return;

  // Apenas GET é cacheável
  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});

// ── Permite forçar atualização manual a partir da página, se necessário ──
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

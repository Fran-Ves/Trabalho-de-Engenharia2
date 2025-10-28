// Service worker simples para cache do shell (opcional)
// Cache-first para recursos locais; ignora tiles externos.
const CACHE_NAME = 'mapa-postos-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // deixar requests de tiles/externos para a rede
  if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('unpkg.com') || url.hostname.includes('cdnjs.cloudflare.com')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request).then(resp => {
      if (resp && resp.ok && event.request.method === 'GET') {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return resp;
    }).catch(() => caches.match('/index.html')))
  );
});
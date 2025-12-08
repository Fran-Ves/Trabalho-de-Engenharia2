// service-worker.js - versão simplificada
const CACHE_NAME = 'postos-app-v4';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json'
];

// Ignorar ícones se não existirem
self.addEventListener('fetch', event => {
  // Não tentar cachear ícones que podem não existir
  if (event.request.url.includes('icon-') && event.request.url.includes('.png')) {
    return; // Deixa o navegador lidar com o 404
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
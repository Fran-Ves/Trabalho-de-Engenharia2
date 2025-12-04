const CACHE_NAME = 'postos-app-v1.0.0';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    
    // Scripts principais
    './js/app.js',
    './js/config/constants.js',
    
    // Modelos
    './js/models/Database.js',
    './js/models/Station.js',
    './js/models/User.js',
    './js/models/Route.js',
    
    // Controladores
    './js/controllers/MapController.js',
    './js/controllers/RouteController.js',
    './js/controllers/AuthController.js',
    './js/controllers/StationController.js',
    './js/controllers/DriverController.js',
    
    // Views
    './js/views/UI.js',
    './js/views/Sidebar.js',
    './js/views/Toast.js',
    
    // Utilitários
    './js/utils/geoutils.js',
    './js/utils/formatters.js',
    
    // Ícones
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Instalar Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache aberto');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Ativar Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
    // Ignorar requisições que não são GET
    if (event.request.method !== 'GET') return;
    
    // Ignorar requisições para APIs externas (exceto OSRM)
    const url = new URL(event.request.url);
    if (url.origin !== location.origin && 
        !url.href.includes('router.project-osrm.org') &&
        !url.href.includes('tile.openstreetmap.org')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retornar do cache se encontrado
                if (response) {
                    return response;
                }
                
                // Fazer requisição de rede
                return fetch(event.request)
                    .then(networkResponse => {
                        // Não cachear respostas que não são OK
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clonar resposta para cache
                        const responseToCache = networkResponse.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Não cachear requisições para OSRM (muitas variações)
                                if (!url.href.includes('router.project-osrm.org')) {
                                    cache.put(event.request, responseToCache);
                                }
                            });
                        
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fallback para página offline
                        if (event.request.headers.get('accept')?.includes('text/html')) {
                            return caches.match('./index.html');
                        }
                        
                        // Fallback para ícone padrão
                        if (event.request.url.includes('.png') || event.request.url.includes('.jpg')) {
                            return caches.match('./icons/icon-192.png');
                        }
                    });
            })
    );
});

// Mensagens do Service Worker
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
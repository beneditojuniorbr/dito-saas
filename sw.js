const CACHE_NAME = 'dito-v7-sync';
const ASSETS_TO_CACHE = [
  '/',
  'index.html',
  'style.css',
  'app.js',
  'D.png',
  'D2.png',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estratégia Network First com Cache-Busting: Garante que as mudanças visuais cheguem no celular sem cache preso
self.addEventListener('fetch', (event) => {
  // Ignora requisições de outras origens ou que não sejam GET
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // IGNORA requisições para o Supabase (API da Rede) para não perder os headers de autenticação
  if (url.hostname.includes('supabase.co')) return;

  const isLocalAsset = ASSETS_TO_CACHE.some(asset => url.pathname.endsWith(asset) || url.pathname === '/');

  // Adiciona um timestamp para forçar o browser a ignorar o cache local e ir no servidor
  // Usamos cache: 'no-store' no fetch para garantir que não pegue cache de nível de sistema (ISP/Browser)
  const busterUrl = isLocalAsset ? `${event.request.url}${event.request.url.includes('?') ? '&' : '?'}t=${Date.now()}` : event.request.url;

  event.respondWith(
    fetch(busterUrl, { cache: 'no-store' }) 
      .then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      })
      .catch(() => caches.match(event.request)) // Se offline total, usa o cache de emergência
  );
});

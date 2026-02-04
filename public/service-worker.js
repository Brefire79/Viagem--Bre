const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `viagem-colaborativa-${CACHE_VERSION}`;

// Workbox injeta automaticamente os arquivos aqui
const PRECACHE_MANIFEST = self.__WB_MANIFEST || [];

// Arquivos essenciais adicionais para cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon.svg'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker versão:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto');
        // Cacheia os arquivos estáticos adicionais
        const staticPromise = cache.addAll(STATIC_ASSETS);
        // Cacheia os arquivos injetados pelo Workbox
        const manifestUrls = PRECACHE_MANIFEST.map(entry => entry.url);
        const manifestPromise = manifestUrls.length > 0 ? cache.addAll(manifestUrls) : Promise.resolve();
        
        return Promise.all([staticPromise, manifestPromise]);
      })
      .then(() => self.skipWaiting()) // Ativa imediatamente
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker versão:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('[SW] Deletando cache antigo:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim()) // Assume controle imediato
      .then(() => {
        // Notifica todos os clientes sobre a atualização
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: CACHE_VERSION
            });
          });
        });
      })
  );
});

// Estratégia de fetch: Network First com Cache Fallback
self.addEventListener('fetch', (event) => {
  // Ignora requisições que não são GET
  if (event.request.method !== 'GET') return;
  
  // Ignora requisições para Firebase e APIs externas
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebase') ||
      event.request.url.includes('api.exchangerate')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a resposta for válida, clona e armazena no cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => {
        // Se falhar, busca do cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            // Se não estiver no cache e for navegação, retorna a página principal
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Listener para mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

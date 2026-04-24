const CACHE_NAME = 'habits-social-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/?source=pwa',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Use catch to avoid failing the whole install if one asset is missing
        return Promise.all(
          ASSETS_TO_CACHE.map(url => {
            return cache.add(url).catch(err => console.log('Failed to cache', url, err));
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          (networkResponse) => {
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Only cache http/https
            if (event.request.url.startsWith('http')) {
              var responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        ).catch(() => {
          // You could return an offline page here if desired
        });
      })
  );
});

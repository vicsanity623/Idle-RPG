const CACHE_NAME = 'idle-rpg-v1.2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=MedievalSharp&family=Cinzel:wght@700&display=swap'
];

// 1. Install Event - Caches the files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching Game Assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting(); // Forces the waiting service worker to become the active service worker
});

// 2. Activate Event - Cleans up old caches if we update the CACHE_NAME version
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Fetch Event - Serves files from cache first, then falls back to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached version if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                return fetch(event.request).then((networkResponse) => {
                    // Don't cache API calls or external dynamic images
                    if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
                        return networkResponse;
                    }

                    // Dynamically cache new assets (like background images)
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            }).catch(() => {
                // If both cache and network fail (offline and not cached), fallback logic can go here
                console.log('[Service Worker] Fetch failed, offline mode.');
            })
    );
});

const CACHE_NAME = 'dungeons-of-fate-v1';

// List of files to cache for offline use
// Using relative paths ensures compatibility with GitHub Pages subdirectories
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './entities.js',
    './main.js',
    './ui.js',
    './skills.js',
    './skillSelector.js',
    './inventory.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install Event - Caches all core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching Game Assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Event - Cleans up old caches when you update the version number
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

// Fetch Event - Cache-First Strategy
// Checks cache first, if not found, fetches from network and caches it.
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
                    // Don't cache if not a valid response
                    if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Clone response and add to cache for next time
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            })
    );
});

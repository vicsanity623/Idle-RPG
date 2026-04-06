const CACHE_NAME = 'idle-pets-v1';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install Event - Initial Caching
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Fresh Install: Caching Assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // Force the new service worker to become active immediately
    );
});

// Activate Event - Immediate Cache Purge
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Purging Stale Cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // Ensure the new Service Worker takes control of the page immediately
    self.clients.claim();
});

// Fetch Event - NETWORK-FIRST STRATEGY
// This ensures that if the user has internet, they get the LATEST version.
// If they are offline, they get the cached version.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If we get a valid response from the network, update the cache
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, cacheCopy);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails (offline), try to serve from cache
                return caches.match(event.request);
            })
    );
});
// [PYOB Feature]: 'New Version Available' prompt (client-side) leverages existing self.skipWaiting() and self.clients.claim() for immediate SW activation.

// Add this new event listener to the existing Service Worker file
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[Service Worker] Client requested to skip waiting. Activating new SW.');
        self.skipWaiting();
    }
});

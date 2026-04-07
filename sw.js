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
                cacheNames
                    .filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => {
                        console.log('[Service Worker] Purging Stale Cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        })
        .then(() => self.clients.claim()) // Ensure the new Service Worker takes control of the page immediately
    );
});

// Fetch Event - NETWORK-FIRST STRATEGY
// This ensures that if the user has internet, they get the LATEST version.
// If they are offline, they get the cached version.
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If we get a valid response from the network, update the cache
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(event.request, cacheCopy))
                        .catch((error) => console.error('[Service Worker] Failed to update cache:', error));
                }
                return networkResponse;
            })
            .catch(async () => {
                // If network fails (offline), try to serve from cache
                const cachedResponse = await caches.match(event.request);
                return cachedResponse || new Response(null, { status: 404, statusText: 'Not Found' });
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

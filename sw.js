const CACHE_NAME = 'idle-pal-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './styles.css',
    './game.js',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
];

// Install Event: Cache assets
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

// Activate Event: Clean up old caches if we update the version
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
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Serve from Cache, Fallback to Network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached file if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Otherwise fetch from the network
                return fetch(event.request).catch(() => {
                    // If offline and trying to navigate to a page, return index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

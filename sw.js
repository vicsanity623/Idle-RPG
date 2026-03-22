const CACHE_NAME = 'dungeons-of-fate-v2';

// List of files to cache for offline use
// Using relative paths ensures compatibility with GitHub Pages subdirectories
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './entities.js',
    './main.js',
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
import { applyCachingStrategy } from './cachingStrategies.js';

self.addEventListener('fetch', applyCachingStrategy);

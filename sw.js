const CACHE_NAME = 'raged-v0.1.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './ui.js',
  './entities.js',
  './engine.js',
  './manifest.json',
  './realms.js',

  // Base World Assets
  './assets/grass.png',
  './assets/sleepless_ghost.png',

  // UI Assets
  './assets/buff_attack.png',
  './assets/buff_speed.png',
  './assets/potion_hp.png',
  './assets/potion_mp.png',
  './assets/skill_attack.png',

  // Player Idle Animation (10 frames)
  './assets/idle/idle00.png',
  './assets/idle/idle01.png',
  './assets/idle/idle02.png',
  './assets/idle/idle03.png',
  './assets/idle/idle04.png',
  './assets/idle/idle05.png',
  './assets/idle/idle06.png',
  './assets/idle/idle07.png',
  './assets/idle/idle08.png',
  './assets/idle/idle09.png',

  // Player Run Animation (8 frames)
  './assets/run/run00.png',
  './assets/run/run01.png',
  './assets/run/run02.png',
  './assets/run/run03.png',
  './assets/run/run04.png',
  './assets/run/run05.png',
  './assets/run/run06.png',
  './assets/run/run07.png',

  // Player Attack Animation (18 frames)
  './assets/attack/atk00.png',
  './assets/attack/atk01.png',
  './assets/attack/atk02.png',
  './assets/attack/atk03.png',
  './assets/attack/atk04.png',
  './assets/attack/atk05.png',
  './assets/attack/atk06.png',
  './assets/attack/atk07.png',
  './assets/attack/atk08.png',
  './assets/attack/atk09.png',
  './assets/attack/atk10.png',
  './assets/attack/atk11.png',
  './assets/attack/atk12.png',
  './assets/attack/atk13.png',
  './assets/attack/atk14.png',
  './assets/attack/atk15.png',
  './assets/attack/atk16.png',
  './assets/attack/atk17.png'
];

// Install Event: Cache files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Clearing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event: Serve from cache if available, otherwise fetch from network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

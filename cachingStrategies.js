const cachingStrategies = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  CACHE_ONLY: 'cache-only'
};

const getCachingStrategy = () => {
  // Get the current caching strategy from local storage
  const strategy = localStorage.getItem('cachingStrategy');
  return strategy || cachingStrategies.CACHE_FIRST;
};

const setCacheStrategy = (strategy) => {
  // Set the caching strategy in local storage
  localStorage.setItem('cachingStrategy', strategy);
};

const applyCachingStrategy = (event) => {
  const strategy = getCachingStrategy();
  switch (strategy) {
    case cachingStrategies.CACHE_FIRST:
      // Implement cache-first strategy
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
      break;
    case cachingStrategies.NETWORK_FIRST:
      // Implement network-first strategy
      event.respondWith(
        fetch(event.request).then((networkResponse) => {
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
        }).catch((error) => {
          // If network fails, return cached version
          return caches.match(event.request);
        })
      );
      break;
    case cachingStrategies.CACHE_ONLY:
      // Implement cache-only strategy
      event.respondWith(
        caches.match(event.request)
          .then((cachedResponse) => {
            // Return cached version if found
            if (cachedResponse) {
              return cachedResponse;
            }
            
            // Otherwise return an error
            return new Response('Not found in cache', { status: 404 });
          })
      );
      break;
    default:
      // Default to cache-first strategy
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
  }
};

self.addEventListener('fetch', applyCachingStrategy);
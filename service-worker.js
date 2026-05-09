const CACHE_NAME = 'odds-monitor-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/service-worker.js'
];

// INSTALL - keširaj osnovne fajlove
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ACTIVATE - očisti stare keševe
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('[SW] Removing old cache', key);
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

// FETCH - network-first za API pozive, cache-first za statiku
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ako je zahtev ka API-ju (pokusaj na prepoznatljive domene), koristimo network-first
  if (url.hostname.includes('api-football') || url.hostname.includes('the-odds-api') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // keširaj uspešne odgovore za offline fallback
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Za ostale resurse: cache-first, pa network fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request)
        .then(response => {
          // keširaj prvu verziju zahteva
          if (!response || response.status !== 200 || response.type !== 'basic') return response;
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
          return response;
        })
        .catch(() => {
          // fallback poruka ili fallback stranica može da se vrati ovde
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
    })
  );
});

// PUSH - prikaz notifikacije (server mora da šalje push događaje)
self.addEventListener('push', (event) => {
  let payload = { title: 'Odds Monitor', body: 'Nova notifikacija', data: {} };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  const title = payload.title || 'Odds Monitor';
  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction || false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// NOTIFICATION CLICK - fokusiraj ili otvori aplikaciju
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// BACKGROUND SYNC - primer (možeš registrovati sync sa tag-om 'sync-matches' iz frontenda)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-matches') {
    event.waitUntil(
      // ovde možeš pozvati endpoint servera da osveži mečeve i kešira ih
      fetch('/api/refresh-matches').catch(err => console.warn('[SW] Sync failed', err))
    );
  }
});

console.log('[SW] Service worker loaded');

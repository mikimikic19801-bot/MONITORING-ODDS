// ⚽ OddsAlert Pro - Service Worker
// Background sync, caching, push notifications

const CACHE_NAME = 'oddsalert-pro-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // './icon-192.png',
  // './icon-512.png',
];

const API_CACHE_NAME = 'oddsalert-api-cache';
const MAX_CACHE_ITEMS = 50;
const CACHE_TTL = 5 * 60 * 1000; // 5 minuta

// 📦 Install event - keširanje statičkih fajlova
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache opened');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 🔄 Activate event - čišćenje starih cache-ova
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 🌐 Fetch event - strategija: Network First za API, Cache First za statiku
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API zahtevi - Network First sa fallback na cache
  if (url.hostname.includes('api-football.com') || 
      url.hostname.includes('the-odds-api.com')) {
    
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Keširaj uspešan odgovor
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
              // Ograniči broj keširanih stavki
              manageCacheSize(API_CACHE_NAME, MAX_CACHE_ITEMS);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback na cache ako nema mreže
          return caches.match(request).then((cached) => {
            if (cached) {
              // Proveri da li je cache svež (< 5 min)
              const cachedTime = cached.headers.get('x-cached-time');
              if (cachedTime && (Date.now() - parseInt(cachedTime)) < CACHE_TTL) {
                return cached;
              }
            }
            // Ako nema svežeg cache-a, vrži offline odgovor
            return new Response(JSON.stringify({ 
              error: 'offline', 
              message: 'Nema internet konekcije' 
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Statički fajlovi - Cache First
  if (request.destination === 'script' || 
      request.destination === 'style' || 
      request.destination === 'image') {
    
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          // Keširaj novi odgovor
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Ostali zahtevi - Default: Network First
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// 🔔 Push Notifications handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const { title, body, icon, badge, tag, data: payload, requireInteraction } = data;
  
  const options = {
    body: body || '',
    icon: icon || '/icon-192.png',
    badge: badge || '/icon-96.png',
    tag: tag || 'oddsalert-default',
    data: payload || {},
    requireInteraction: requireInteraction !== false,
    actions: [
      { action: 'open', title: 'Otvori' },
      { action: 'mute', title: 'Utišaj' }
    ],
    vibrate: [200, 100, 200],
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 🔘 Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'mute') {
    // Pošalji poruku glavnoj aplikaciji da utiša zvuk
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'MUTE_SOUNDS' });
      });
    });
    return;
  }
  
  // Otvori aplikaciju na odgovarajućoj stranici
  const urlToOpen = event.notification.data?.url || './index.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Ako je aplikacija već otvorena, fokusiraj je
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Inače otvori novi tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// 📡 Background Sync za slanje izveštaja
self.addEventListener('sync', (event) => {
  if (event.tag === 'send-odds-report') {
    event.waitUntil(sendOddsReport());
  }
});

// 🕐 Periodic Background Sync (ako je podržan)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-odds-every-15min') {
    event.waitUntil(checkOddsPeriodically());
  }
});

// 🧹 Funkcija za upravljanje veličinom cache-a
async function manageCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // Obriši najstarije stavke
    const itemsToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(itemsToDelete.map((key) => cache.delete(key)));
  }
}

// 📤 Funkcija za slanje izveštaja o kvotama
async function sendOddsReport() {
  // Ovo se izvršava u background-u
  try {
    // Primer: slanje snapshot-a kvota na 13h/17h
    const reportData = {
      timestamp: new Date().toISOString(),
      type: 'odds_snapshot',
      // ... podaci o kvotama
    };
    
    // await fetch('https://tvoj-proxy/api/report', {
    //   method: 'POST',
    //   body: JSON.stringify(reportData)
    // });
    
    console.log('[SW] Report sent:', reportData);
  } catch (error) {
    console.error('[SW] Failed to send report:', error);
    // Retry logic could go here
  }
}

// 🔄 Periodična provera kvota
async function checkOddsPeriodically() {
  try {
    // Ova funkcija bi se pozivala svakih 15 min (ako browser podržava)
    console.log('[SW] Periodic odds check triggered');
    
    // Obavesti sve otvorene tabove
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ 
        type: 'PERIODIC_ODDS_CHECK',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[SW] Periodic check failed:', error);
  }
}

// 💬 Message handler za komunikaciju sa glavnom aplikacijom
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_API_RESPONSE':
      // Ručno keširanje API odgovora sa timestamp-om
      caches.open(API_CACHE_NAME).then((cache) => {
        const responseWithTime = new Response(payload.body, {
          headers: {
            ...payload.headers,
            'x-cached-time': Date.now().toString()
          }
        });
        cache.put(payload.url, responseWithTime);
      });
      break;
      
    case 'REQUEST_NOTIFICATION_PERMISSION':
      // Pokreni request za notifikacije iz SW konteksta
      self.registration.showNotification('OddsAlert Pro', {
        body: 'Omogući obaveštenja za alerte uživo! 🔔',
        icon: '/icon-192.png',
        tag: 'permission-request'
      });
      break;
      
    case 'CLEAR_ALL_CACHE':
      caches.keys().then((names) => {
        names.forEach((name) => caches.delete(name));
      });
      event.ports[0]?.postMessage({ success: true });
      break;
      
    case 'GET_CACHE_STATUS':
      caches.keys().then(async (names) => {
        const status = {};
        for (const name of names) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          status[name] = keys.length;
        }
        event.ports[0]?.postMessage({ success: true, cacheStatus: status });
      });
      break;
  }
});

// 🎵 Background audio za alerte (Web Audio API u SW)
function playAlertSoundInSW(soundType = 'alert') {
  // Napomena: Audio u Service Worker-u je ograničen
  // Bolje je poslati poruku glavnoj aplikaciji da pusti zvuk
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ 
        type: 'PLAY_SOUND', 
        sound: soundType,
        timestamp: Date.now()
      });
    });
  });
}

// 🚨 Helper za slanje visoko-prioritetnih notifikacija
function sendCriticalAlert({ title, body, matchId, oddsData, alertType }) {
  const payload = {
    title: title || '⚠️ Važan Alert',
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    tag: `alert-${matchId}-${alertType}`,
    data: {
      url: `./index.html?match=${matchId}`,
      matchId,
      oddsData,
      alertType,
      timestamp: Date.now()
    },
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    actions: [
      { action: 'view', title: 'Detalji' },
      { action: 'mute_match', title: 'Utišaj ovaj meč' }
    ]
  };
  
  return self.registration.showNotification(title, payload);
}

// 📊 Snapshot kvota u 13h i 17h
async function scheduleOddsSnapshots() {
  const now = new Date();
  const currentHour = now.getHours();
  
  // Proveri da li je vreme za snapshot (13h ili 17h ± 2 min)
  const isSnapshotTime = (currentHour === 13 || currentHour === 17) && now.getMinutes() <= 2;
  
  if (isSnapshotTime) {
    try {
      console.log('[SW] 📸 Taking odds snapshot at', now.toISOString());
      
      // Pošalji poruku aplikaciji da pripremi snapshot
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({ 
          type: 'TAKE_ODDS_SNAPSHOT',
          hour: currentHour,
          timestamp: Date.now()
        });
      });
      
      // Zakaži sledeći snapshot
      scheduleNextSnapshot();
    } catch (error) {
      console.error('[SW] Snapshot failed:', error);
    }
  }
}

function scheduleNextSnapshot() {
  const now = new Date();
  const next13 = new Date(now);
  next13.setHours(13, 0, 0, 0);
  if (next13 <= now) next13.setDate(next13.getDate() + 1);
  
  const next17 = new Date(now);
  next17.setHours(17, 0, 0, 0);
  if (next17 <= now) next17.setDate(next17.getDate() + 1);
  
  const nextSnapshot = next13 < next17 ? next13 : next17;
  const delay = nextSnapshot.getTime() - now.getTime();
  
  console.log(`[SW] Next snapshot scheduled in ${Math.round(delay/60000)} min`);
  
  // Napomena: setTimeout u SW nije pouzdan - koristiti Background Sync API
  // Ovo je ilustrativno
}

// 🎯 Inicijalizacija
self.addEventListener('activate', (event) => {
  // ... prethodni activate kod ...
  
  // Zakaži snapshot proveru
  scheduleOddsSnapshots();
  
  // Proveri svakih sat vremena da li je vreme za snapshot
  setInterval(scheduleOddsSnapshots, 60 * 60 * 1000);
});

console.log('⚽ OddsAlert Pro Service Worker loaded! 🚀');

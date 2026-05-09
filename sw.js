const CACHE = 'oddsalert-v2';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if(e.request.url.includes('api-football') || e.request.url.includes('the-odds-api')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request).then(r => r || new Response('Offline', {status:503})))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if(res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request)))
  );
});

self.addEventListener('push', e => {
  const d = e.data?.json() || {title:'⚽ Alert', body:'Nova promena na meču'};
  e.waitUntil(self.registration.showNotification(d.title, { body:d.body, tag:d.tag||'default', icon:'./icon-192.png' }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow('./index.html'));
});

const scope = new URL(self.registration.scope);
const index = new URL('index.html', scope).href;
const prefix = 'iron-core-offline:' + scope.href + ':';
const cacheName = prefix + 'v3';
const assets = ['index.html', 'manifest.webmanifest', 'icon-192.webp', 'icon-512.webp', 'shared-logo.webp']
  .map(path => new URL(path, scope).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll(assets.map(url => new Request(url, { cache: 'reload' })))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' && url.origin === scope.origin &&
      (url.pathname === scope.pathname || url.pathname === new URL(index).pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(cacheName);
      const saved = await cache.match(index);
      return saved || fetch(request);
    })());
  } else if (assets.includes(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache =>
      (await cache.match(request)) || fetch(request)
    ));
  }
});

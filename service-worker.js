const CACHE_NAME = 'casur-transportes-gps-v5-8-conductor-envio-20260619-01';
const APP_SHELL = [
  './', './index.html', './simulador.html', './styles.css?v=5.8.0', './app.js?v=5.8.0', './manifest.json', './offline.html',
  './assets/logo_casur.png',
  './data/poligonos_casur.geojson?v=5.8.0', './data/metadata.json', './data/referencias_operativas.json?v=5.8.0', './data/maestro_fincas.json',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL.map(u => new Request(u, { cache:'reload' }))))
      .catch(err => console.warn('SW install parcial', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k.startsWith('casur-transportes-gps')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isExternalCached(url){
  return url.hostname.includes('tile.openstreetmap.org') ||
         url.hostname.includes('arcgisonline.com') ||
         url.hostname.includes('unpkg.com') ||
         url.hostname.includes('cdn.jsdelivr.net');
}

function isAppShellFile(url){
  return url.pathname.endsWith('/') ||
         url.pathname.endsWith('/index.html') ||
         url.pathname.endsWith('/simulador.html') ||
         url.pathname.endsWith('/app.js') ||
         url.pathname.endsWith('/styles.css') ||
         url.pathname.endsWith('/manifest.json') ||
         url.pathname.endsWith('/service-worker.js');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(req.mode === 'navigate'){
    event.respondWith(
      fetch(req, { cache:'no-store' })
        .then(res => { const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{}); return res; })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html').then(c => c || caches.match('./offline.html'))))
    );
    return;
  }

  if(isExternalCached(url)){
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{}); return res;
    }).catch(() => caches.match(req)));
    return;
  }

  if(isAppShellFile(url)){
    event.respondWith(
      fetch(req, { cache:'no-store' })
        .then(res => { const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{}); return res; })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{}); return res; }).catch(() => cached || caches.match('./offline.html'));
      return cached || network;
    })
  );
});

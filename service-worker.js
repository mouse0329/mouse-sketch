const CACHE_NAME = 'mouse-sketch-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/img/nezumi-drawing_icon.webp',
  // lib配下の主要JS
  '/lib/anim.js',
  '/lib/animWorker.js',
  '/lib/b64.js',
  '/lib/gif.js',
  '/lib/gif.worker.js',
  '/lib/GIFEncoder.js',
  '/lib/LZWEncoder.js',
  '/lib/NeuQuant.js',
  '/lib/UPNG.js',
  // サブページ
  '/about/index.html',
  '/license/index.html',
  '/terms/index.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // オフライン時のフォールバック
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

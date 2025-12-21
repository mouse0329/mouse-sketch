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

// インストール時に基本ファイルをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // 新しいSWを即アクティブ化
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // 全クライアントに新SWを適用
  );
});

// フェッチ時：オンライン優先、オフラインはキャッシュ
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request) // まずネットから取得
      .then(networkResponse => {
        // ネット取得成功したらキャッシュも更新
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // ネットがダメならキャッシュから取得
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          // キャッシュにも無い場合はページならindex.htmlを返す
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

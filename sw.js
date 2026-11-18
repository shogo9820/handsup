const CACHE_NAME = 'party-game-v2';
const ASSETS_TO_CACHE = [
  'index.html',
  'css/style.css',
  'js/words.js',
  'js/common.js',
  'js/game-gesture.js',
  'js/game-taboo.js',
  'manifest.json',
  'icon.png',
  'icon-512.png'
];

// インストール時にファイルをキャッシュ
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 古いバージョンのキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// オフライン時はキャッシュからファイルを返す
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

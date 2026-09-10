const CACHE_NAME = 'party-game-v1';
const ASSETS_TO_CACHE = [
  'index.html',
  'css/style.css',
  'js/words.js',
  'js/common.js',
  'js/game-gesture.js',
  'js/game-taboo.js',
  'manifest.json'
];

// インストール時にファイルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// オフライン時はキャッシュからファイルを返す
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

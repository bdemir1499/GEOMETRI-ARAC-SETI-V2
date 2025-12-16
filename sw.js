const CACHE_NAME = 'geometri-arac-seti-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './ruler.js',
  './gonye.js',
  './aciolcer.js',
  './pergel.js',
  './polygon.js',
  './manifest.json',
  './icon.png'
  // Varsa buraya 'sesler/tik.mp3' gibi ses dosyalarınızı da ekleyin
];

// Yükleme (Install)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Çekme (Fetch) - İnternet yoksa önbellekten sun
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
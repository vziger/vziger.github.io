// sw.js — offline shell.
// App code (HTML/CSS/JS) = network-first so updates appear on reload;
// heavy vendored libs & icons = cache-first. Offline falls back to cache.
const CACHE = 'pdf2stl-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/viewer.js',
  './js/geometry.js',
  './js/pdf-extract.js',
  './js/image-process.js',
  './vendor/pdf.mjs',
  './vendor/pdf.worker.mjs',
  './vendor/three.module.js',
  './vendor/OrbitControls.js',
  './vendor/earcut.min.js',
  './vendor/polygon-clipping.umd.js',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// treat app code as "fresh-preferred"; libs/icons as "cache-preferred"
function isAppCode(url) {
  return url.origin === location.origin &&
    (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.js') || url.pathname.endsWith('/') ||
     url.pathname.endsWith('.webmanifest'));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isAppCode(url)) {
    // network-first, bypassing the HTTP cache so edits always win when online
    e.respondWith(
      fetch(req, { cache: 'reload' }).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
  } else {
    // cache-first (vendor libs, icons, images)
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }))
    );
  }
});

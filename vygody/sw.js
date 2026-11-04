// Offline support: keeps the site files on the phone so it opens without internet.
// Bump VERSION after changing any file in this folder so phones pick up the new version.
var VERSION = 'vyg-v1';
var APP = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(APP); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // The page: try the network first so updates arrive, fall back to the saved copy offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('index.html', copy); });
      }
      return res;
    }).catch(function () { return caches.match('index.html'); }));
    return;
  }

  // Icons, manifest and fonts: use the saved copy, fetch and save it the first time.
  var sameOrigin = url.origin === self.location.origin;
  var font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !font) return;
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      if (res.ok || res.type === 'opaque') {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); });
      }
      return res;
    });
  }));
});

// Offline support: keeps the app files on the phone so it opens without internet.
// Bump VERSION after changing any app file so phones pick up the new version.
var VERSION = 'emo-v7';
var APP = [
  './', 'index.html', 'style.css',
  // Emotions
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  // Polarities (its own link and its own app on the phone)
  'polarities.html', 'manifest-polarities.webmanifest', 'icon-pol-192.png', 'icon-pol-512.png', 'apple-touch-icon-pol.png'
];

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
  var sameOrigin = url.origin === self.location.origin;

  // Practice pages and the shared stylesheet: try the network first so updates arrive,
  // fall back to the saved copy offline. Each page is saved under its own address.
  if (req.mode === 'navigate' || (sameOrigin && /\.css$/.test(url.pathname))) {
    var key = url.origin + url.pathname;
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && !res.redirected) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(key, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(key).then(function (hit) { return hit || caches.match('index.html'); });
    }));
    return;
  }

  // Icons, manifest and fonts: use the saved copy, fetch and save it the first time.
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

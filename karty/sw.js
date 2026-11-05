// Offline support: keeps the app files and the built-in cards on the phone so it opens without internet.
// Bump VERSION after changing any app file or the card list so phones pick up the new version.
importScripts('cards.js');
var VERSION = 'mak-v5';
var APP = ['./', 'index.html', 'style.css', 'cards.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
var DECK = (Array.isArray(self.DECK) ? self.DECK : []).map(function (f) { return encodeURI('cards/' + String(f).trim()); });

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // App files must all be saved; a card picture that fails to download is fetched again later.
    return c.addAll(APP).then(function () {
      return Promise.all(DECK.map(function (u) { return c.add(u).catch(function () {}); }));
    });
  }).then(function () { return self.skipWaiting(); }));
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

  // Pages, stylesheets and the card list: try the network first so updates arrive,
  // fall back to the saved copy offline. Each page is saved under its own address.
  if (req.mode === 'navigate' || (sameOrigin && /\.(css|js)$/.test(url.pathname))) {
    var key = url.origin + url.pathname;
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && !res.redirected) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(key, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(key).then(function (hit) {
        if (hit) return hit;
        return req.mode === 'navigate' ? caches.match('index.html') : Response.error();
      });
    }));
    return;
  }

  // Card pictures, icons, manifest and fonts: use the saved copy, fetch and save it the first time.
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

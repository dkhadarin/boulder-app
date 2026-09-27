// Offline cache for the app shell. Bump VERSION on every deploy.
const VERSION = "v4-log";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "lib/progress.js",
  "lib/store.js",
  "lib/warnings.js",
  "lib/events.js",
  "lib/pending.js",
  "lib/queue.js",
  "lib/bridge.js",
  "ui/format.js",
  "ui/charts.js",
  "ui/progress-view.js",
  "ui/status-view.js",
  "ui/forms.js",
  "ui/log-view.js",
  "manifest.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first, cache as fallback: updates arrive when online, app still opens offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

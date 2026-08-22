/* Service worker: cache the app shell so wing-weather installs and loads
   offline. API responses (NOAA / Open-Meteo) always go to the network. */
const CACHE = "wing-weather-v31";
const SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/config.js",
  "./js/storage.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/year.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Only the app shell (same-origin) is cached; let API calls hit the network.
  if (url.origin !== self.location.origin) return;

  // Serve only from the CURRENT version's cache so a page never mixes files
  // from different deploys (which caused stale config + new code skew).
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        });
      })
    )
  );
});

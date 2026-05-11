// Service worker — cached-first met netwerk-fallback
// Vergroot CACHE_VERSION om gebruikers een update te forceren.
const CACHE_VERSION = "training-v1";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png",
];

// External CDN-resources (React + Tabler Icons)
const CDN_URLS = [
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Cache de lokale bestanden eerst, CDN-bestanden best-effort
      return cache.addAll(PRECACHE_URLS).then(() => {
        return Promise.all(
          CDN_URLS.map((url) =>
            fetch(url)
              .then((resp) => {
                if (resp.ok) return cache.put(url, resp);
              })
              .catch(() => {})
          )
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Cache succesvolle GET-responses
          if (response.ok && (response.type === "basic" || response.type === "cors")) {
            const respClone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(event.request, respClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Bij offline en geen cache: probeer index.html als fallback voor navigaties
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});

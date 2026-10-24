const SHELL = "underfit-socios-v2";
const ASSETS = [
  "/socios/", "/socios/index.html", "/socios/styles.css", "/socios/app.js",
  "/socios/manifest.webmanifest", "/socios/icon.svg"
];
self.addEventListener("install", event => event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== SHELL).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || event.request.url.includes("/api/") || event.request.url.includes("/media/")) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(SHELL).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("/socios/"))));
});

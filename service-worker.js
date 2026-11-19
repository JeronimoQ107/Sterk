// La versión debe coincidir con package.json y con Ajustes (src/dashboard.js); tests/service-worker.test.mjs lo comprueba.
// Cambiar este archivo es lo que hace que el iPhone descargue una versión nueva.
const CACHE_PREFIX = "sterk-";
const CACHE_NAME = "sterk-v1-7-5";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/styles.css",
  "./src/app.js",
  "./src/data.js",
  "./src/sets.js",
  "./src/weight-picker.js",
  "./src/weight-control.js",
  "./src/reps-control.js",
  "./src/reps-picker.js",
  "./src/icons.js",
  "./src/dashboard.js",
  "./src/progress.js",
  "./src/storage.js",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.svg",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/exercises/pec-deck.png",
];

// PWA-02: cada versión se descarga completa desde la red. `cache: "reload"` evita guardar copias
// antiguas de la caché HTTP del navegador; si falla un archivo, la instalación falla entera y el
// teléfono sigue usando la versión anterior completa.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

// PWA-01: solo se borran versiones anteriores de Sterk, no otras cachés del mismo origen.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(respond(request));
});

// Todo sale de la caché de esta versión, nunca de la de otra: así HTML, módulos y estilos siempre
// pertenecen a la misma versión. Lo que no forma parte de la app se pide a la red sin guardarlo.
async function respond(request) {
  const cache = await caches.open(CACHE_NAME);
  const navigation = request.mode === "navigate";
  const cached = await cache.match(request, { ignoreSearch: navigation });
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    // Sin conexión, una navegación abre la app guardada; un recurso nunca se sustituye por HTML.
    const shell = navigation ? await cache.match("./index.html") : null;
    return shell || Response.error();
  }
}

// ─────────────────────────────────────────────
// TunePath — Service Worker
// ─────────────────────────────────────────────
// Necesario para que el navegador considere la app "instalable".
// Estrategia deliberadamente conservadora: sólo se cachea el shell de la
// app (HTML/CSS/JS). NUNCA se cachean las llamadas a la API de Spotify,
// porque devuelven datos con token y cambian constantemente.

const CACHE = 'tunepath-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  // Sólo GET del mismo origen. Fuera: Spotify API, cuentas, imágenes CDN.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones: red primero, caché como respaldo offline.
  // Así una versión nueva desplegada en Render se ve de inmediato.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos: caché primero, con actualización en segundo plano.
  event.respondWith(
    caches.match(request).then(cached => {
      const red = fetch(request)
        .then(res => {
          if (res && res.status === 200) {
            const copia = res.clone();
            caches.open(CACHE).then(c => c.put(request, copia));
          }
          return res;
        })
        .catch(() => cached);
      return cached || red;
    })
  );
});
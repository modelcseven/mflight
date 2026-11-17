/* MFlight service worker: makes the app installable and keeps the shell usable on a flaky connection.
   - App shell (HTML) : network first, cached copy when offline.
   - Built assets      : cache first (file names are content-hashed).
   - Images / fonts    : stale-while-revalidate.
   - /api, /uploads POSTs and anything cross-origin except Google Fonts: never cached. */
const VERSION = 'mflight-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/theme-init.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;
  if (sameOrigin && (url.pathname.startsWith('/api/') || url.pathname === '/sw.js')) return;

  // Page navigations: network first, fall back to the cached shell.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  // Hashed build assets: cache first.
  if (sameOrigin && url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Images, icons, uploads, fonts: stale-while-revalidate.
  if (fonts || /\.(png|jpe?g|webp|gif|svg|woff2?)$/i.test(url.pathname)) {
    e.respondWith(
      caches.open(VERSION).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req)
            .then((res) => {
              if (res.ok || res.type === 'opaque') c.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        }),
      ),
    );
  }
});

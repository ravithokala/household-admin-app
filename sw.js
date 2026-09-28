// @ts-check

/**
 * Caches the app shell only, so the app opens offline. The data is not cached here: it lives in
 * IndexedDB (store/db.js). Requests to other sites (the API, Google sign-in) go to the network.
 * tests/pwa.test.js checks SHELL lists every file of the app. Bump VERSION with each publish.
 */
const VERSION = 'shell-v2';
const SHELL = ['./', 'index.html', 'app.js', 'api.js', 'auth.js', 'config.js', 'dom.js', 'theme.js', 'theme-boot.js', 'version.js', 'styles.css',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'shared/dates.js', 'shared/model.js', 'shared/templates.js', 'shared/sensitive.js', 'shared/validation.js', 'shared/renewals.js',
  'store/db.js', 'store/changes.js', 'store/store.js',
  'views/sheet.js', 'views/fields.js', 'views/parts.js', 'views/dashboard.js', 'views/list.js', 'views/item.js', 'views/itemForm.js',
  'views/renew.js', 'views/entities.js', 'views/more.js', 'views/chart.js'];

/**
 * The worker's global scope. Typed loosely: the DOM and WebWorker type libraries cannot be combined.
 * @type {any}
 */
const sw = self;

sw.addEventListener('install', (/** @type {any} */ event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (/** @type {any} */ event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => sw.clients.claim()));
});

// Network first, so a new version shows straight away; the cache covers going offline.
// 'no-cache' asks GitHub Pages whether each file changed instead of trusting the browser's copy.
sw.addEventListener('fetch', (/** @type {any} */ event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
  event.respondWith(fetch(event.request, { cache: 'no-cache' })
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
      }
      return response;
    })
    .catch(() => caches.match(event.request, { ignoreSearch: true }).then((hit) => hit ?? caches.match('index.html')).then((hit) => hit ?? Response.error())));
});

/* Rückwärts-Rätsel – Service Worker: Offline-Start + Push-Benachrichtigungen */
const CACHE = "rr-__BUILD__";
const CORE = ["./", "index.html", "app.js", "words.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/vendor/")) {          // KI-Stimme: einmal laden, dann aus dem Speicher
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req.mode === "navigate" ? req.url : req, {cache: "no-cache"}).then(res => {  // sonst: immer die neueste Version, offline aus dem Speicher
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || caches.match("index.html"))));
});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {body: e.data && e.data.text()}; }
  const title = d.title || "Rückwärts-Rätsel";
  e.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: d.body || "", icon: "icons/icon-192.png", badge: "icons/badge-96.png",
      tag: d.tag || "rr", renotify: true, data: {game: d.game || null}
    });
    const list = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    list.forEach(c => c.postMessage({type: "push", game: d.game || null}));
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const game = e.notification.data && e.notification.data.game;
  const target = new URL(game ? `./#g=${game}` : "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) {
        await c.focus();
        c.postMessage({type: "open", game});
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});

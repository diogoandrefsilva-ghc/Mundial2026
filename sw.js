/* Service worker — Simulador Mundial 2026
   Estratégia: network-first para o documento (apanha sempre a versão mais recente
   quando há rede; cai na cache offline) e cache-first para os restantes ficheiros
   do próprio domínio. A app ESPN (cross-origin) nunca é cacheada. */
const VERSION = "mundial-2026-v1";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    // sem clients.claim(): evita um controllerchange (e reload) no 1.º arranque;
    // só uma actualização real (skipWaiting) toma o controlo e dispara o reload.
  })());
});

// a página pede para promover a nova versão -> activa-a já (dispara controllerchange)
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // ESPN/fontes -> deixa ir à rede

  // documento/navegação: rede primeiro, cache como salvaguarda offline
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone();
        caches.open(VERSION).then(c => c.put(req, cp));
        return r;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // restantes ficheiros do domínio: cache primeiro
  e.respondWith(caches.match(req).then(r => r || fetch(req).then(resp => {
    const cp = resp.clone();
    caches.open(VERSION).then(c => c.put(req, cp));
    return resp;
  }).catch(() => r)));
});

const CACHE_PREFIX = "npt-static-";
const CACHE_NAME = `${CACHE_PREFIX}__NPT_VERSION__`;
const ASSETS = /* precache */ [];
const ASSET_PATHS = new Set(ASSETS);
const INDEX = "/index.html";

self.addEventListener("install", (event) => {
  // Installation succeeds only when the entire release, including figures, is cached.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })));
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
  // Updates wait for existing windows to close; never replace an active assessment.
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const path = request.mode === "navigate" && (url.pathname === "/" || url.pathname === INDEX)
    ? INDEX
    : url.pathname;
  if (!ASSET_PATHS.has(path)) return;
  // Only build assets are cached. Session data and exports never enter this cache.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(path) || fetch(request);
  })());
});

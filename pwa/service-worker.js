const CACHE_PREFIX = "npt-static-";
const CACHE_NAME = `${CACHE_PREFIX}__NPT_VERSION__`;
const APP_VERSION = "__NPT_APP_VERSION__";
const ASSETS = /* precache */ [];
const HASHES = /* hashes */ {};
const ASSET_PATHS = new Set(ASSETS);
const INDEX = "/index.html";

async function matchesRelease(response, path) {
  if (!response?.ok) return false;
  const digest = await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer());
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex === HASHES[path];
}

async function verifyOffline(repair = false) {
  const cache = await caches.open(CACHE_NAME);
  const missing = (await Promise.all(ASSETS.map(async (path) => {
    if (await matchesRelease(await cache.match(path), path)) return null;
    if (repair) {
      try {
        const response = await fetch(new Request(path, { cache: "reload" }));
        // Never mix newer, unversioned figures/HTML into the current release.
        if (await matchesRelease(response, path)) {
          await cache.put(path, response);
          return null;
        }
      } catch { /* Report the missing file without disturbing valid cached files. */ }
    }
    return path;
  }))).filter(Boolean);
  return { version: APP_VERSION, ready: missing.length === 0, missing };
}

self.addEventListener("install", (event) => {
  // Installation succeeds only when the entire release, including figures, is cached.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(ASSETS.map((url) => new Request(url, { cache: "reload" })));
      if (!(await verifyOffline()).ready) throw new Error("Offline release failed integrity verification.");
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
  // Updates wait for existing windows to close; never replace an active assessment.
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "VERIFY_OFFLINE") return;
  event.waitUntil(verifyOffline(event.data.repair === true)
    .then((result) => event.ports[0]?.postMessage(result))
    .catch(() => event.ports[0]?.postMessage({ ready: false, missing: ASSETS })));
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

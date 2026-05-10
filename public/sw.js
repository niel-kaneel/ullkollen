// Ullkollen service worker — NetworkFirst for everything.
// Conservative strategy: never serve a stale app shell; only fall back to
// cache when the network actually fails (offline). No precache.
const VERSION = "ullkollen-v1";
const RUNTIME = `runtime-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== RUNTIME).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function shouldBypass(url, request) {
  // Never cache non-GET, auth, Supabase storage uploads, or server functions.
  if (request.method !== "GET") return true;
  if (url.pathname.startsWith("/_serverFn")) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.hostname.includes("supabase.co") && url.pathname.includes("/storage/")) return true;
  if (url.hostname.includes("supabase.co") && url.pathname.includes("/auth/")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldBypass(url, request)) return;
  if (url.origin !== self.location.origin && !url.hostname.includes("gstatic.com") && !url.hostname.includes("googleapis.com")) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeout);
        if (response && response.status === 200 && response.type === "basic") {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await cache.match("/");
          if (shell) return shell;
        }
        throw err;
      }
    })()
  );
});

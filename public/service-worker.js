// Kill-switch service worker (alt path).
// Mirrors /sw.js — old installs may have registered either path.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map((c) => {
            try {
              const url = new URL(c.url);
              url.searchParams.set("sw-cleanup", Date.now().toString());
              return c.navigate(url.toString());
            } catch {
              return undefined;
            }
          })
        );
        await self.registration.unregister();
      } catch (e) {
        // Best-effort cleanup.
      }
    })()
  );
});

self.addEventListener("fetch", () => {});

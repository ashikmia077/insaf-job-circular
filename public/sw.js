/**
 * Insaf Job Circular — PWA Service Worker (Phase 1 Foundation)
 * Handles offline fallback caching and Firebase Cloud Messaging (FCM) Web Push events.
 */

const CACHE_NAME = "insaf-job-circular-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((staleKey) => caches.delete(staleKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || "Insaf Job Circular";
    const options = {
      body: payload.body || "New verified job circular published.",
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      data: {
        url: payload.url || "/",
      },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Ignore malformed push payloads
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  event.waitUntil(self.clients.openWindow(targetUrl));
});

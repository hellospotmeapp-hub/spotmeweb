// SpotMe Service Worker - v3.0.0
// Handles caching, push notifications, offline support, and SPA navigation fallback
const CACHE_NAME = 'spotme-v3';
const STATIC_ASSETS = [
  '/',
];

// Install - cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, with SPA navigation fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip Supabase/API requests entirely - never cache these
  if (event.request.url.includes('databasepad.com') || 
      event.request.url.includes('supabase') ||
      event.request.url.includes('/functions/')) return;

  // Skip .well-known requests - these must always be served fresh from the server
  // (iOS and Android fetch these to verify Universal Links / App Links)
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/.well-known/')) return;



  // ---- SPA NAVIGATION FALLBACK ----
  // For navigation requests (HTML page loads), serve the cached root page
  // This prevents 404 errors when refreshing on deep routes like /create, /need/123, etc.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If we get a good response, cache it and return
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed - serve the cached root page (SPA shell)
          // This allows the client-side router to handle the route
          return caches.match('/').then((cachedRoot) => {
            if (cachedRoot) return cachedRoot;
            // Last resort: return a basic offline page
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpotMe - Offline</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAFAF8;color:#2C2925;text-align:center;padding:20px}h1{color:#F2785C;font-size:32px}p{color:#A9A29B;margin-top:8px}button{background:#F2785C;color:white;border:none;padding:12px 32px;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-top:24px}</style></head><body><div><h1>SpotMe</h1><p>You appear to be offline.</p><p>Check your connection and try again.</p><button onclick="location.reload()">Retry</button></div></body></html>',
              {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
              }
            );
          });
        })
    );
    return;
  }

  // ---- STATIC ASSETS: Network first, cache fallback ----
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline', { status: 503 });
        });
      })
  );
});

// ---- PUSH NOTIFICATIONS ----

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'SpotMe',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'spotme-notification',
    url: '/',
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || payload.message || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        url: payload.url || payload.data?.url || data.url,
        data: payload.data || {},
      };
    }
  } catch (e) {
    // If JSON parse fails, try text
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    vibrate: [100, 50, 100],
    data: {
      url: data.url,
      ...data.data,
    },
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    requireInteraction: false,
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Analytics: track dismissed notifications
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// Handle push subscription change (browser re-subscribes)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        // Re-register with server
        return fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription.endpoint,
            newSubscription: subscription.toJSON(),
          }),
        });
      })
  );
});

// Background sync for offline contributions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-contributions') {
    event.waitUntil(syncPendingContributions());
  }
});

async function syncPendingContributions() {
  try {
    const cache = await caches.open('spotme-pending');
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const data = await response.json();
        try {
          await fetch(request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          await cache.delete(request);
        } catch (e) {
          console.log('[SW] Sync failed for:', request.url);
        }
      }
    }
  } catch (e) {
    console.log('[SW] Background sync error:', e);
  }
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  // Force clear old caches when app requests it
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    }).then(() => {
      // Re-cache root
      caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS));
    });
  }
});

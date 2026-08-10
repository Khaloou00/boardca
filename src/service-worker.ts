/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';

// InjectManifest will replace process.env.WB_MANIFEST with the generated precache list
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'BoardCA Notification';
    const options = {
      body: data.body || '',
      icon: '/Logo_bnetd_transparence.png',
      badge: '/Logo_bnetd_transparence.png',
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    // Fallback if not JSON
    event.waitUntil(
      self.registration.showNotification('BoardCA', {
        body: event.data.text(),
        icon: '/Logo_bnetd_transparence.png'
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Optionally open a specific URL
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus if already open
      for (const client of clientList) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/mobile'); // Fallback to mobile app root
      }
    })
  );
});

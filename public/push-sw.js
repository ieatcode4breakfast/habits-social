self.addEventListener('push', function (event) {
  let data = { title: 'New message on Habits Social', body: 'Open Inbox to view it.', url: '/inbox' };
  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch {
      // Invalid JSON payload, use defaults
    }
  }
  const title = data.title || 'New message on Habits Social';
  const options = {
    body: data.body || 'Open Inbox to view it.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/inbox' },
    tag: 'chat-message',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : '/inbox';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

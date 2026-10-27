// Cal's push notifications: shows what the server sent, and opens its link when clicked.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Cal.diy", {
      body: data.body,
      icon: data.icon,
      badge: data.icon,
      data: data.data,
      tag: data.tag,
      renotify: Boolean(data.tag),
      requireInteraction: data.requireInteraction ?? false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});

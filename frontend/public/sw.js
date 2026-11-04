const notificationUrl = (value) => {
  try {
    const target = new URL(value || "/", self.location.origin);
    return target.origin === self.location.origin ? target.href : self.location.origin;
  } catch {
    return self.location.origin;
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || "Ouvre Veloce pour consulter le message." };
  }

  const title = payload.title || "Nouveau message sur Veloce";
  const options = {
    body: payload.body || "Tu as reçu un nouveau message.",
    icon: "/veloce-mark.svg",
    badge: "/veloce-mark.svg",
    tag: payload.tag || "veloce-message",
    renotify: true,
    data: { url: notificationUrl(payload.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = notificationUrl(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});

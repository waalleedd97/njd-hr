// NJD HR — Push Notification Service Worker

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "NJD HR", body: event.data ? event.data.text() : "" };
  }

  var title = data.title || "NJD HR";
  var options = {
    body: data.body || "",
    icon: "/logo.png",
    badge: "/favicon-32x32.png",
    tag: data.tag || "njd-hr-notification",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Only allow navigation to same-origin paths. Push payloads are user-controlled
// in their content, so never trust an absolute URL from data.url — reduce to a
// pathname only and fall back to "/" on anything unexpected.
function sanitizeUrl(rawUrl) {
  try {
    var parsed = new URL(rawUrl || "/", self.location.origin);
    if (parsed.origin !== self.location.origin) return "/";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch (e) {
    return "/";
  }
}

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var raw = event.notification.data && event.notification.data.url;
  var url = sanitizeUrl(raw);
  var target = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var clientUrl = clientList[i].url;
        // Strict same-origin + exact-path match rather than substring search.
        if (clientUrl === target && "focus" in clientList[i]) {
          return clientList[i].focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});

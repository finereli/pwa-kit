# Push notifications

## Push notifications

### Setup flow

1. Fetch VAPID public key from the server
2. `Notification.requestPermission()`
3. `navigator.serviceWorker.ready` -> `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` with base64url-to-Uint8Array conversion
4. POST the subscription object to the server

### Service worker handler

Parse `event.data.json()` with a text fallback. Include `icon: '/icon-192.png'`, `badge: '/badge-72.png'` (72px monochrome glyph for Android status bar - easy to forget), and `vibrate: [200, 100, 200]`.

On `notificationclick`: find an existing window with `clients.matchAll()` and focus it, or `clients.openWindow()`. Deep-link via `/?chat=<id>`, consumed on boot then cleaned with `history.replaceState`.

Server: use `web-push`, fan out to all stored subscriptions. Self-heal by deleting subscriptions that return 404/410.

Include a "Send test notification" button in settings - it's how you debug the entire chain.

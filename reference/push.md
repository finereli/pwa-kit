# Push notifications

The kit's `push/` item is all of this as code (server, routes, client, service worker, schema, a test). Use it; the notes below say why it is the way it is.

## Push notifications

### Setup flow

1. Fetch VAPID public key from the server
2. `Notification.requestPermission()`
3. `navigator.serviceWorker.ready` -> `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` with base64url-to-Uint8Array conversion
4. POST the subscription object to the server

### Service worker handler

Parse `event.data.json()` with a text fallback. Include `badge: '/badge-72.png'` (72px monochrome glyph for Android status bar - easy to forget) and `vibrate: [200, 100, 200]`. Leave out `icon`: Android already shows the app's icon on the left and draws `icon` again as a thumbnail on the right, which takes the room the message needs. The message is what people read, two lines at most (about 48 characters on a Samsung) before it's cut off, so write short, complete messages; the title barely shows.

On `notificationclick`: find an existing window with `clients.matchAll()` and focus it, or `clients.openWindow()`. Deep-link via `/?chat=<id>`, consumed on boot then cleaned with `history.replaceState`.

Server: fan out to all stored subscriptions. Self-heal by deleting subscriptions that return 404/410. On Node, `web-push`; it does not run in a Cloudflare Worker (it needs Node's crypto), where the message encryption (RFC 8291, aes128gcm) and the VAPID token (RFC 8292) are about 80 lines on WebCrypto: the kit's `push/functions/web-push.ts`, with a test that decrypts what it sends.

### Keeping it on

A subscription can vanish under the user with nothing in the UI saying so, and Settings then reads "off" as if they had turned it off:

- **The reload button.** `updates.reset()` unregisters the service worker, and on Android the push subscription belongs to the worker. Every reset silently ends push.
- **The browser.** Chrome can replace a subscription on its own (`pushsubscriptionchange`).

So:

1. When the user turns push on, record it on the device (localStorage, e.g. `<app>.push.v1 = on`); clear it when they turn it off. The browser's subscription is not the record of intent.
2. On every launch, if that flag is set and `Notification.permission === 'granted'`: get the subscription, `subscribe()` if there is none (no prompt once permission is granted), and POST it to the server either way (an upsert; it also brings back one the server dropped). If permission is granted and a subscription exists but the flag doesn't, set the flag: that's a device from before the flag.
3. In the service worker, handle `pushsubscriptionchange`: take `event.newSubscription` (or subscribe again with `event.oldSubscription.options`) and POST `{ old: oldEndpoint, sub }` to a renew endpoint. The worker has no session token, so the endpoint accepts it only as a replacement for an endpoint it already stores; knowing a live endpoint is the proof.

Include a "Send test notification" button in settings - it's how you debug the entire chain.

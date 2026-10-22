# push

Web push for a PWA on Cloudflare: turning it on per device, sending from a Worker or Pages Function without the `web-push` package, and keeping it on when the subscription vanishes underneath. Extracted from notime, where it runs in production on Android (Chrome, Samsung) and iOS (home-screen app). The rules behind it are in `reference/push.md`.

## Files

| File | Goes to | What |
|---|---|---|
| `functions/web-push.ts` | `shared/functions/` (or the Worker's dir) | RFC 8291 encryption + RFC 8292 VAPID on WebCrypto; `fanOut(db, payload, env)` sends to every device and deletes the gone ones |
| `functions/push-routes.ts` | next to it | `pushRoutes({ request, url, db, vapid, signedIn })`: key, subscribe, unsubscribe, test, renew. Returns `null` for other paths |
| `lib/push.ts` | `shared/lib/` | `makePush({ apiJson, storageKey })`: `pushState`, `enablePush`, `disablePush`, `keepPush`, `testPush` |
| `public/push-sw.js` | `public/` | the service worker half: `push`, `notificationclick`, `pushsubscriptionchange` |
| `db/push.sql` | a migration | the `push_subs` table |
| `scripts/vapid.mjs` | run once | prints the key pair and subject for the app's secrets |
| `test/web-push.test.ts` | the app's tests | decrypts a message as the browser would; verifies the VAPID signature |

Wiring, beyond copying:

- vite.config, in `pwaOptions`: `workbox: { importScripts: ['/push-sw.js'], globIgnores: ['**/node_modules/**/*', '**/reset.html', '**/push-sw.js'] }`. The worker imports the file; it is not precached, so a change to it rides the update flow.
- In the app: `export const push = makePush({ apiJson, storageKey: '<app>.push.v1' })`, call `push.keepPush()` on launch once signed in (and again on sign-in), and give Settings a toggle (`enablePush`/`disablePush`, words per `pushState()`) and a "Send a test" button.
- On the server, before the other routes: `const r = await pushRoutes({ ... }); if (r) return r`. Renew must be reachable without a session.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Decisions baked in

- No `web-push` package: it needs Node's crypto and does not run in a Worker. The encryption is aes128gcm with one record; the test decrypts it the way a browser does, which is the only check that means anything.
- Intent lives on the device (`storageKey` in localStorage), not in the browser's subscription. `updates.reset()` unregisters the service worker, and on Android the subscription belongs to the worker, so a reset silently ended push and Settings read "off" as if the user had turned it off. `keepPush()` on launch re-subscribes (no prompt once permission is granted) and re-posts the subscription (an upsert, which also restores one the server dropped). A device that had push on before the flag existed is recognised by its live subscription.
- `pushsubscriptionchange` in the service worker hands the new subscription to `/api/push/renew` with the old endpoint. The worker has no session, so renew only replaces an endpoint already stored: knowing a live endpoint is the proof. `keepPush()` covers the same case on the next launch.
- 404 and 410 from a push service delete the row; anything else counts as a failure and keeps it.
- `TTL: 86400`, `Urgency: high`: a reply that waits a day is still worth seeing; a phone in doze delivers high urgency.
- On iOS push exists only for a home-screen app: `pushState()` says `needs-install` in Safari so Settings can explain instead of failing.

## Seams

`storageKey`; the endpoint paths (change them in both `push-routes.ts` and `lib/push.ts`); `testPayload` in `pushRoutes`; the payload fields the app sends (`title`, `body`, `tag`, `url`, `unread`); icon and badge paths in `push-sw.js`; a user column in `push_subs` (and the queries) for a multi-user app.

## Verify

- `test/web-push.test.ts` passes (copy it next to the app's tests, fix the import path).
- On a real phone: Settings → turn on → "Send a test" arrives. Tap it → the app opens at `url`.
- Tap the drawer's reload icon (a reset), reopen the app → "Send a test" still arrives without turning push on again. Check the server's `push_subs`: a new row from the re-subscribe.
- `curl -X POST /api/push/renew` with an unknown `old` → 404; with a stored one → the row is replaced.

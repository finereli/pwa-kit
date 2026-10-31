# Caching, service worker and the update flow

Kit: `updates/` (registration + update logic, reset button, reset.html, vite build helper). Read the item README for the verify recipe; do run it.

## The property that matters

**A plain reload always gets the newest version.** Everything else is about choosing the moment. If you remember one thing: never park a service worker in `waiting`. A waiting worker is never released by a reload, so a phone on v98 with v103 installed behind it is structurally stuck until someone clears site data. That is what happened, and it is why the flow below exists.

## Service worker strategy

vite-plugin-pwa with workbox, `registerType: 'autoUpdate'`, `injectRegister: null` (we register ourselves), `skipWaiting: true`, `clientsClaim: true`. Precache the shell (JS, CSS, HTML, fonts, icons); `navigateFallback: '/index.html'` for the SPA, with a denylist for `/api/`, static asset dirs, `/reset.html`, and the server's own pages (`/oauth/`, `/mcp`, `/.well-known/`, which an agent's sign-in link opens).

The worker takes over as soon as it has downloaded. Precache means instant offline launch, and it is safe precisely because the worker never waits.

**Never cache media.** Audio/video elements issue no-cors range requests; the worker only sees opaque responses, and an opaque response cannot be sliced, so a caching handler breaks seeking rather than enabling offline. Serve media from R2 behind a custom domain with `Cache-Control: public, max-age=31536000, immutable`. Real offline is an explicit per-item download with CORS into the Cache API.

**Never precache `reset.html`** and never let the navigate fallback serve it. It is the out-of-band escape hatch and must load past the worker even when the app is stuck.

**Public read APIs** (content lists) get `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600` so the CDN absorbs the load and content goes live within minutes without a redeploy.

## Update flow

`shared/lib/updates.svelte.js` registers the worker and decides when the page reloads into a new version:

1. A new worker taking over fires `controllerchange`. That is the signal. (Not workbox-window's `isUpdate`, which is false for any page that loaded uncontrolled: first visit, hard refresh. That was the previous bug: the update button did nothing.)
2. If nobody is looking, reload on the spot: the app is in the background, or it just launched (`performance.now() < 10s`) and hasn't been touched (no pointerdown/keydown yet).
3. Otherwise `available` turns on. The drawer's reload icon lights up in the accent colour with the label "tap to update"; a tap reloads now. Sending the app to the background applies it silently.
4. The host can veto the silent moments with `canReload`: `() => !player.playing` in a media app (a reload would cut off a meditation), `() => !uploadQueue.hasActive()` in an admin, `() => !anyStreaming` in a chat app. The update just waits for the next quiet moment.
5. Check for a new version on launch, on every return to the foreground, and hourly while open. Register the worker yourself; don't use `virtual:pwa-register`.

Register: an update pill/badge/lit icon, never a full-width banner (both families independently demoted the banner: "too loud").

## Escape hatches

Two, always:

- **The reload icon** next to the build number in the drawer. Normally `updates.reset()`: unregister every worker, delete every cache, reload from the network, keep localStorage (login, settings). When an update is waiting it doubles as the update control.
- **`/reset.html`** on the app's domain: does the same with none of the app's code. Send that link to someone whose app is stuck on a build older than the reload icon.

## Versions

Show a version at the bottom of the drawer, small, last in the footer right after the reload icon (`v1.40`; see shell.md → Sidebar for the footer order): `MAJOR.<build>`, where the build is the total git commit count, baked in at build time as `__BUILD__` (CI checks out full history for this: `fetch-depth: 0`). It counts up by itself and never needs deciding. `MAJOR` is a constant, bumped by hand only for a rewrite. Nobody consumes it; it is a label a user can read back to you.

`BUILD_NUMBER=<n>` overrides the count. That is how you exercise the flow locally: build twice with different numbers, serve `dist/` with `wrangler pages dev`, swap builds under the running page, watch the drawer.

## Testing the flow

Do it once per app. Cases: fresh install; visible + interacted → icon lights → tap reloads; background apply; quiet launch reloads by itself; two tabs; a hard-refreshed (uncontrolled) page; the reload icon; `/reset.html`; a page from the previous update-era (it should un-stick itself). Details in `kit/updates/README.md`.

## Pull-to-refresh

Was added as an update workaround; removed once updates were automatic. Don't add it for that reason. For content apps it's still fine to leave the browser's own pull-to-refresh alone; for player and chat views set `overscroll-behavior-y: none` on the scroller.

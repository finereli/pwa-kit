# updates

The service-worker update flow: activate on download, page picks the reload moment, two escape hatches, versions. Spec: `reference/updates.md`.

## Files

| Kit file | Goes to |
|---|---|
| `lib/updates.svelte.ts` | `shared/lib/` |
| `ui/ResetButton.svelte` | `shared/ui/` (drawer, next to the build number) |
| `build/pwa-build.ts` | `shared/build/` (imported by `vite.config.ts`) |
| `public/reset.html` | `public/` of each app |
| `src/build.d.ts` | `src/` (declares `__BUILD__`) |

Wire: `updates.init({ canReload })` in `main.ts` before mount; `VitePWA(pwaOptions({...}))` and `define: { __BUILD__ }` in `vite.config.ts` (see `shell/vite.config.ts`); `<ResetButton>` + `גרסה {__BUILD__}` in the drawer footer.

## Decisions baked in

- Worker registered by this module, not `virtual:pwa-register`: the plugin's reload logic only fires for pages that were already controlled, so after a hard refresh or on first visit the update button silently did nothing.
- `skipWaiting + clientsClaim`: never park a worker in waiting; a waiting worker is never released by a reload and phones got stuck.
- `controllerchange` is the signal; `current` distinguishes "the worker we knew claiming this page" (ignore) from a new one. `undefined` until registration resolves, `null` on first visit.
- Quiet moments: hidden, or launched under 10s ago with no pointerdown/keydown yet. Otherwise `available` lights the icon and backgrounding applies.
- `canReload` veto for audio/upload/stream. `#reloading` guard so apply/reset never double-fire.
- `reset()` keeps localStorage (login). `reset.html` is outside the precache and the navigate fallback so it works when the app can't.
- `reset()` unregisters the worker, and on Android a push subscription belongs to the worker: a reset silently turns push off. An app with push re-subscribes on launch (see reference/push.md, "Keeping it on").
- The navigate fallback leaves `/oauth/`, `/mcp` and `/.well-known/` to the server, along with `/api/`: those are pages other software sends the user to (an agent's OAuth consent link), and the cached app must not answer them.
- Version = `MAJOR.<commit count>`; `BUILD_NUMBER` env overrides for local testing.

## Seams

`canReload`; `MAJOR` in vite.config; ResetButton labels (`updateLabel`, `resetLabel`); reset.html lang/title/strings/colours; `pwaOptions` manifest, includeAssets, globPatterns, navigateFallbackDenylist (replace it whole: keep the defaults when adding to it).

## Verify (do this once per app)

```
BUILD_NUMBER=1 npm run build && cp -r dist /tmp/b1
BUILD_NUMBER=2 npm run build && cp -r dist /tmp/b2
npx wrangler pages dev /tmp/b1 --port 8790     # then swap: rm -rf /tmp/b1/* && cp -r /tmp/b2/* /tmp/b1/
```
Cases: fresh install shows v1; swap builds, tap the page, wait for the hourly check or toggle visibility → icon lights, tap → v2; swap again and background the tab → comes back as new version; swap, then reload a fresh tab within 10s without touching → reloads itself; hard-refresh a page (uncontrolled) then swap → still updates; reload icon resets; `/reset.html` loads past the worker and returns to the app signed in; with the worker controlling the page, navigating to `/oauth/anything` reaches the server (its 404 or page), not the app.

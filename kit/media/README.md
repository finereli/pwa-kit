# media

The playback engine: one `<audio>` owns everything, muted video follows its clock, MediaSession, wanted-flag resume, position persistence. Spec: `reference/media.md`.

## Files

`lib/player.svelte.ts`, `lib/progress.ts` → `shared/lib/`. App: `export const player = new Player({ audioUrl, artist, artwork, beforePlay, onEnded })` in `src/lib/player.svelte.ts`; `player.init()` once; `visibilitychange` → `player.resync()`; `pagehide` → `player.flush()`; `updates.init({ canReload: () => !player.playing })`. Video items: `<video muted playsinline>` with `attachVideo`/`detachVideo`.

## Decisions baked in

Rate-nudge sync (0.02 / 0.06 / 0.5s thresholds, ±4%) with hysteresis; hard seek only on real discontinuities; rAF loop, frozen while hidden; resume applied at `loadedmetadata`; `RESUME_FLOOR` 10s, `DONE_TAIL` 20s, save every 5s; `wanted` retry on background pause; `preload` metadata → auto on play; prev restarts if past 5s; MediaSession handlers in try/catch.

## Seams

`audioUrl(item)`, `artist`/`album`/`artwork`, `beforePlay`/`onEnded`/`onLoad` hooks (bells), progress storage key (`setBackend(localStorageBackend(key))`) and backend (`setBackend` for server sync).

## Verify

Lock screen shows title/artwork and controls work; screen off keeps playing; a video item resyncs on foreground without visible seek; cold reload resumes mid-item; a finished item restarts from 0.

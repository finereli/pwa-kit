# theme

Two levels. Take the first for any app with dark mode; take the second only when people pick their own colour - most apps don't need it.

## v1: dark mode and accent palettes (`lib/theme.ts`)

Dark mode applied before first paint (copy the inline `<script>` from the header comment into `index.html`) and `applyAccent(hex)`, which derives the accent scale from one hex. Verify: toggle dark with a saturated accent → buttons legible, backgrounds tinted not neon; reload → no white flash.

## v2 upgrade: a Theme settings page (appearance + accent + icon)

| Kit file | Goes to |
|---|---|
| `lib/appearance.svelte.ts` | `shared/lib/` - light / dark / match device, one rune shared by the sidebar toggle and the Theme page |
| `lib/accent.ts` | `shared/lib/` - presets, `storedAccent`, `setAccent` (applies + caches) |
| `lib/appicon.ts` | `shared/lib/` - redraws the app icon in the accent and swaps favicon, apple-touch-icon and the manifest |
| `ui/AppearancePicker.svelte`, `ui/AccentPicker.svelte` | `shared/ui/` |

Wiring: `main.ts` calls `setAccent(storedAccent())` before mount. When the user's saved accent arrives from the server, `setAccent(saved)` (an `$effect` in App). Set `appearance.accent = () => saved ?? storedAccent()` so a light/dark switch re-derives the accent for the new mode. A Theme page (a `settings` sub-page) holds both pickers; the sidebar footer keeps a one-tap light/dark icon that calls `appearance.toggle()`.

### Decisions

- Appearance is per device (localStorage); "match device" is no stored value at all, which the first-paint snippet already reads as "ask the OS". The accent is per user (server), cached on the device for first paint.
- Eight presets tuned to stay legible in both modes, plus any colour. The default preset saves as null, so the app can change its default later.
- The custom swatch is a hidden `<input type="color">` inside a rainbow circle, clipped with `clip-path` (border-radius alone left a square-ish native swatch showing).
- The picker previews live while dragging and saves on close (`change`), so dragging doesn't spam the server.
- Runtime icon: PNGs drawn from an SVG on a canvas, opaque squares, glyph at 86% / maskable at 76% - the same as the shipped files. The manifest is swapped for a blob URL with absolute `start_url`/`scope`; Chrome on Android reads it at install time (verified on Angel). An already-installed app keeps the icon it was installed with. The default colour keeps the shipped files.

### Seams

`ACCENTS`, the storage keys (`app.accent.v1`, and `app.dark.v1` which must match `theme.ts` and `index.html`), `GLYPH` / `GLYPH_CY` / `APP` in `appicon.ts`.

### Verify

Pick a preset → app and favicon change, reload → no flash of the old colour. Drag the custom picker → live preview; close → saved; second device → same colour. Toggle dark → accent re-derived. Android: install after picking a colour → home-screen icon in that colour, with margin.

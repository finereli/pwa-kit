# shell

The app skeleton: tokens + reset, top bar, drawer/sidebar, button, `index.html`, `App`/`main` templates, and the project config files (vite, tsconfig, svelte, package.json). Spec: `reference/shell.md`, `reference/visual.md`.

## Files

| Kit file | Goes to |
|---|---|
| `css/base.css` | `shared/css/` (import first from `src/app.css`) |
| `ui/TopBar.svelte`, `ui/Drawer.svelte`, `ui/Btn.svelte` | `shared/ui/` |
| `index.html` | app root |
| `src/App.svelte`, `src/main.ts` | `src/` (templates; replace the views) |
| `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `package.json` | app root |

## Decisions baked in

- `#app { position: fixed; inset: 0 }`, body `overflow: hidden`, one scroller per view: the app is exactly the visible area, above Android's navigation bar, and the keyboard (`interactive-widget=resizes-content`) shrinks it instead of covering it. No viewport units: installed Android PWAs report `100dvh` taller than the screen they show.
- Viewport `viewport-fit=cover, maximum-scale=1.0, user-scalable=no`: an app, not a page (a chosen trade-off).
- TopBar: 44px leading button, trailing spacer so the title centres, `--safe-top` padding, chevron flips under `[dir='ltr']`.
- Drawer: `min(78vw, 300px)`, slides from the start edge in either direction, permanent sidebar ≥768px with `.shell { margin-inline-start }`, Escape closes, host closes on navigation.
- Components reference only the token names in `base.css`; re-skinning is redefining values.
- `beforeinstallprompt` captured inline in `index.html`.
- `npm run build` runs `svelte-check` first: the type check is part of the build.

## Seams

Token values in `:root`; TopBar/Drawer labels; Drawer `brand`/`footer` snippets; manifest, MAJOR, includeAssets in `vite.config.ts`; `lang`/`dir`, title, theme-color in `index.html`.

## Verify

iPhone with a notch: top bar padded, nothing under the home indicator. Android with 3-button navigation, installed: the bottom of the app sits fully above the buttons. Keyboard open (Android): layout resizes, the bottom bar sits on the keyboard, no page scroll. Desktop ≥768: sidebar permanent, no scrim, hamburger hidden. Escape and the back button both close the drawer. `npm run check` clean.

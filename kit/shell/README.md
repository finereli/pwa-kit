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

- `html, body, #app { height: 100dvh }`, body `overflow: hidden`, one scroller per view: keyboard resizes the layout instead of pushing it.
- Viewport `viewport-fit=cover, maximum-scale=1.0, user-scalable=no`: an app, not a page (a chosen trade-off).
- TopBar: 44px leading button, trailing spacer so the title centres, `--safe-top` padding, chevron flips under `[dir='ltr']`.
- Drawer: `min(78vw, 300px)`, slides from the start edge in either direction, permanent sidebar ≥768px with `.shell { margin-inline-start }`, Escape closes, host closes on navigation.
- Components reference only the token names in `base.css`; re-skinning is redefining values.
- `beforeinstallprompt` captured inline in `index.html`.
- `npm run build` runs `svelte-check` first: the type check is part of the build.

## Seams

Token values in `:root`; TopBar/Drawer labels; Drawer `brand`/`footer` snippets; manifest, MAJOR, includeAssets in `vite.config.ts`; `lang`/`dir`, title, theme-color in `index.html`.

## Verify

iPhone with a notch: top bar padded, nothing under the home indicator. Keyboard open: layout resizes, no page scroll. Desktop ≥768: sidebar permanent, no scrim, hamburger hidden. Escape and the back button both close the drawer. `npm run check` clean.

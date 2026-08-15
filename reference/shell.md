# Shell: viewport, safe areas, manifest, layout, scroll, RTL

Kit: `shell/` (base.css with the token set and resets, TopBar, Drawer, Btn, index.html, App/main templates). Copy it; the notes below say why it is the way it is.

## The viewport and PWA boilerplate

Every app starts with this. Don't skip any of it.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="...">
<meta name="theme-color" content="...">
```

`user-scalable=no` is a deliberate choice: this is an app, not a page, and pinch-zoom on a player or a chat reads as broken. Accessibility purists disagree; we chose app-feel. `interactive-widget=resizes-content` plus a `100dvh` shell that never scrolls is what makes the keyboard resize the layout instead of pushing it.

The theme-color meta tag should update dynamically when dark mode toggles: accent color in light mode, surface color in dark mode.

### Height handling

Mobile browsers lie about viewport height. Use `100dvh` as the primary unit, plus a JS fallback for older browsers:

```javascript
function setVh() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}
window.addEventListener('resize', setVh);
setVh();
setTimeout(setVh, 100);
setTimeout(setVh, 300);
```

The delayed recalculations catch mobile browser chrome settling after load. Use `height: 100dvh` in CSS, falling back to `calc(var(--vh, 1vh) * 100)`.

### Safe areas

Define these variables globally:

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

Use them in: top bars (`padding-top: calc(var(--safe-top) + 6px)`), bottom-docked elements (`padding-bottom: calc(var(--safe-bottom) + Npx)`), full-screen overlays.

### Manifest

```json
{
  "display": "standalone",
  "background_color": "<surface-color>",
  "theme_color": "<accent-color>",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

The maskable icon should keep the mark at ~62% inside the safe zone so OS masks don't clip it.

### Service worker

See `updates.md`. Short version: workbox precache of the shell, worker activates on download, the page decides when to reload, never cache media, `/reset.html` outside the worker.

### Touch behavior

```css
body {
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
}

button, a, [role="button"] {
  touch-action: manipulation;
}
```

## Layout

### App shell

```
┌─────────────────────────────┐
│         Top Bar (52px)       │
├──────────┬──────────────────┤
│          │                  │
│ Sidebar  │   Main Content   │
│ (280px)  │   (flex: 1)      │
│          │                  │
│          │                  │
├──────────┴──────────────────┤
│    Bottom Bar (optional)     │
└─────────────────────────────┘
```

Full-height flex layout: `display: flex; height: 100dvh; overflow: hidden`.

### Sidebar

- Width: `min(78vw, 300px)` (280px fixed in the chat apps)
- Desktop (768px+ content apps, 1024px+ chat apps): always visible, no scrim, `.shell { margin-inline-start: <width> }`, hamburger hidden
- Mobile: `position: fixed`, slides in from the start edge, `transform: translateX(-100%)` (`translateX(100%)` under `[dir='rtl']`)
- Transition: `transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)`
- Scrim behind: `rgba(0, 0, 0, 0.45)`, opacity transition, z-index above content
- Escape closes it; the host closes it on every navigation (router.onChange), which is what makes the back button close it too
- Bottom of the drawer: user row, sign-out, then the build line with the reload icon (see updates.md)

### Main content

- `flex: 1; display: flex; flex-direction: column; min-width: 0`
- Scrollable body: `flex: 1; overflow-y: auto`
- Input area / bottom bar: `flex: none`, pinned to bottom with `border-top`

### Content width

- Messages/content: full width on mobile, `max-width: 70%` on desktop (1024px+) for readability
- Settings/forms: `max-width: 42rem`, centered
- Cards/library: `max-width: 620px`, centered

### Breakpoints

Keep it simple. One primary breakpoint:

- `768px` for content apps (library, about pages)
- `1024px` for chat apps (wider sidebar threshold)

At the breakpoint: sidebar becomes permanent, hamburger hides, font size can step up to 18px base.

## Scroll and overscroll

### Structural scroll control

The app shell itself never scrolls - `html, body { overflow: hidden }`, app root at `100dvh`. Each view has exactly one inner element with `overflow-y: auto`.

For chat apps where pull-to-refresh would interfere with the scrolled message list, add `overscroll-behavior-y: none` on the scroller. Same for player views and any fixed-layout screen.

For content apps (library, feed, settings), leave the browser's pull-to-refresh alone; the structural approach (document doesn't scroll, inner element does) already prevents accidental triggers mid-scroll. Don't build your own pull-to-refresh as an update mechanism; the update flow (updates.md) makes it unnecessary, and the one we built was removed the same week.

## RTL support

For Hebrew/Arabic apps:

- Set `<html lang="he" dir="rtl">` and `"dir": "rtl"` in the manifest
- Force `direction: ltr` on: progress bars, transport controls, time displays, numeric sequences
- Use logical properties where possible: `inset-inline-start`, `margin-inline-start`, `border-inline-end`
- Directional icons (back arrows, send arrows) need `scaleX(-1)` - design the raw SVG for the primary direction, flip for the other
- The sidebar slides from the start edge (left in LTR, right in RTL)

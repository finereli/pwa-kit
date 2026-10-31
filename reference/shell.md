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

`user-scalable=no` is a deliberate choice: this is an app, not a page, and pinch-zoom on a player or a chat reads as broken. Accessibility purists disagree; we chose app-feel. `interactive-widget=resizes-content` plus a `position: fixed; inset: 0` shell that never scrolls is what makes the keyboard resize the layout instead of pushing it. (The kit's `index.html` carries it; it had been missing there.)

The theme-color meta tag should update dynamically when dark mode toggles: accent color in light mode, surface color in dark mode.

### Height handling

The app root is `position: fixed; inset: 0`. A fixed element with `inset: 0` is the layout viewport, which is exactly the visible area: the browser keeps it above the system navigation bar and, with `interactive-widget=resizes-content`, shrinks it while the keyboard is open. No viewport units, no JS.

Don't size the shell with viewport units. Measured on a Samsung phone with 3-button navigation, Chrome 154 (viewport-lab, Oct 2026):

| | browser tab | installed PWA |
|---|---|---|
| visible area (`innerHeight`) | 669 | 725 |
| `100vh` / `100dvh` / `100lvh` | 725 / 669 / 725 | **781** / **781** / **781** |
| `100svh` | 669 | 725 |
| `position: fixed; inset: 0` | 669 | 725 (470 with keyboard) |
| `env(safe-area-inset-bottom)` | 0 | 0 |

Installed, Chrome treats the navigation bar like a browser toolbar that could slide away, so the "large" and "dynamic" viewport are 56px taller than the screen: a `100dvh` shell puts its bottom bar behind the buttons. `viewport-fit` made no difference, and the insets were 0 because Chrome doesn't draw under the 3-button bar at all. Only the fixed box was right in every mode, with the keyboard open and closed, and only with `resizes-content` (`resizes-visual` and `overlays-content` leave the keyboard over the bottom bar). The older `--vh` JS fallback is gone with it.

### Safe areas

Define these variables globally:

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

Use them in: top bars (`padding-top: calc(var(--safe-top) + 6px)`), bottom-docked elements (`padding-bottom: calc(var(--safe-bottom) + Npx)`), full-screen overlays. They matter on iOS (notch, home indicator). On Android an installed app reports 0 and the fixed shell already stops above the navigation bar; Chrome's edge-to-edge (`env(safe-area-max-inset-bottom)`, the chin) applies to pages that scroll under a gesture bar, which the shell never does.

### Manifest

```json
{
  "display": "standalone",
  "background_color": "<surface-color>",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Icons

- **PNG icons are opaque, full-bleed squares.** The platform rounds them. A rounded icon with transparent corners turns them black on iOS and doubles the rounding on Android.
- **The maskable icon is its own file.** Reusing the `any` icon as maskable is what made Angel's mark touch the edges on Android: the launcher crops to a circle or squircle and only the central ~80% is safe. Mark at ~86% of the square in the `any` icons, ~76% in the maskable one.
- **Generate them all from one source** (an SVG of the mark, or its polygons) with a small script in the repo, so a size change is one number. Only the tab favicon (`favicon.svg`) keeps rounded corners.
- **An icon in the user's colour** is the `theme` kit's v2 upgrade (`appicon.ts`): drawn at runtime and swapped into the favicon, apple-touch-icon and a blob manifest. It works for installs made after the pick; an installed app keeps its old icon.

**No `theme_color` in the manifest.** An installed Android app paints its system navigation bar with the manifest's `theme_color`, and the manifest has one value with no dark variant (Chrome's `dark_theme_color` experiment is no longer parsed). So an accent there is a coloured bar under the dark theme, and a dark surface there is a dark bar under the light one. Left out, the navigation bar takes the phone's own light/dark default, which looks right in both. The status bar still follows the page's `theme-color` meta, which the app switches with its theme. Seen on Samsung OneUI with 3-button navigation, Chrome, Oct 2026: notime and 100 Shots had set `theme_color` to the dark surface as a workaround; Emotion Stack dropped it and the bar followed the phone. (Older notes said `background_color` was behind the bar; on that phone it was `theme_color`.)

vite-plugin-pwa fills in its own green when `theme_color` is missing, so the kit's `pwaOptions` passes `theme_color: undefined` explicitly; its "will not be able to be installed" warning is wrong for Chrome, which doesn't require the field. `background_color` is the splash screen: the page colour of the theme the owner uses. The installed app keeps the manifest it was installed with until Chrome refreshes the WebAPK (up to about a day); uninstall and reinstall to see a change at once.

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

Full-height flex layout inside the fixed `#app`: `display: flex; flex-direction: column; height: 100%`.

### Sidebar

- Width: `min(78vw, 300px)` (280px fixed in the chat apps)
- Desktop (768px+ content apps, 1024px+ chat apps): always visible, no scrim, `.shell { margin-inline-start: <width> }`, hamburger hidden
- Mobile: `position: fixed`, slides in from the start edge, `transform: translateX(-100%)` (`translateX(100%)` under `[dir='rtl']`)
- Transition: `transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)`
- Scrim behind: `rgba(0, 0, 0, 0.45)`, opacity transition, z-index above content
- Shadow only while open: translated off-screen, the drawer's blur still reaches past its edge and shades the page's start edge
- Escape closes it; the host closes it on every navigation (router.onChange), which is what makes the back button close it too
- Top and bottom bands are the same height: the brand band and the footer are both `--topbar-h` (56px) plus their safe area, so the sidebar looks balanced. The drawer itself has no vertical padding; the bands carry the safe areas.
- Footer: one row. `AccountMenu` (avatar + name, never the email) on the start side; a tap opens a small menu upwards with Sign out. Small icons on the end, in this order: the one-tap light/dark icon when the app has dark mode (moon in light, sun in dark; the Light / Dark / Match device picker goes on a settings page, never in the drawer), the version as small secondary text (`v1.40`), the reload icon right beside it (see updates.md), and the settings gear when the app has one. The version sits next to the reload icon because that is where someone looks when you ask which version they're on, and the reload is what fixes a wrong one. Email and delete-my-data go on the Account settings page.

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

The app shell itself never scrolls - `body { overflow: hidden }`, app root `position: fixed; inset: 0`. Each view has exactly one inner element with `overflow-y: auto`.

For chat apps where pull-to-refresh would interfere with the scrolled message list, add `overscroll-behavior-y: none` on the scroller. Same for player views and any fixed-layout screen.

For content apps (library, feed, settings), leave the browser's pull-to-refresh alone; the structural approach (document doesn't scroll, inner element does) already prevents accidental triggers mid-scroll. Don't build your own pull-to-refresh as an update mechanism; the update flow (updates.md) makes it unnecessary, and the one we built was removed the same week.

## RTL support

For Hebrew/Arabic apps:

- Set `<html lang="he" dir="rtl">` and `"dir": "rtl"` in the manifest
- Force `direction: ltr` on: progress bars, transport controls, time displays, numeric sequences
- Use logical properties where possible: `inset-inline-start`, `margin-inline-start`, `border-inline-end`
- Directional icons (back arrows, send arrows) need `scaleX(-1)` - design the raw SVG for the primary direction, flip for the other
- The sidebar slides from the start edge (left in LTR, right in RTL)

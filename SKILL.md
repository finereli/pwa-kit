---
name: pwa
description: Build mobile-first PWAs that feel native - covers visual style (colors, typography, components), behavioral patterns (auth, reconnection, keyboard, caching), and PWA boilerplate (manifest, service worker, safe areas). Load before writing any component or styling code for a new mobile app.
---

# PWA Mobile App Style Guide

Build mobile-first PWAs that feel native, look warm, and share a common technical foundation. This skill codifies the patterns across Eli's apps (Angel, Glopus, Yael's meditations app) into a reusable system.

Use this skill when building a new PWA or mobile web app. Load it before writing any component, layout, or styling code. The guidance here overrides generic defaults - follow it exactly unless the brief explicitly calls for something different.

**Evolving document.** After every app build, discuss whether the skill needs updating - new patterns learned, constants that should change, sections that didn't hold up. Don't update silently; raise it and talk it through so the skill doesn't over-fit to whatever we built last.

## Stack

Svelte + Vite + Cloudflare Workers. Static adapter for pure client apps, Cloudflare Pages for apps with a worker backend. CSS custom properties for theming - not Tailwind's dark: variants, not a component library. Inline SVG icons with `currentColor`, never an icon library CDN.

## The viewport and PWA boilerplate

Every app starts with this. Don't skip any of it.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="...">
```

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

Network-first for API routes and dynamic content. Precache the shell (JS, CSS, HTML, fonts, icons). Don't cache media files - opaque responses break seeking. Add a navigate fallback to `/index.html` for the SPA shell.

Handle `controllerchange` with auto-reload:

```javascript
navigator.serviceWorker?.addEventListener('controllerchange', () => location.reload());
```

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

## Color system

Every app defines its palette through CSS custom properties. The token names are semantic, not color-named.

### Minimum token set

```css
:root {
  --accent: <primary-color>;
  --bg-surface: <main-background>;
  --bg-sidebar: <sidebar-background>;
  --bg-hover: <hover-state>;
  --bg-active: <selected-state>;
  --bg-message: <assistant-bubble>;
  --bg-code: <code-block-background>;
  --bg-input: <input-field>;
  --border: <borders-and-dividers>;
  --text-primary: <main-text>;
  --text-secondary: <timestamps-labels-meta>;
}
```

Apps that need more granularity (a card background, a warm surface variant, a deep accent) add tokens as needed. Don't pre-define tokens you don't use.

### Dark mode: Catppuccin Mocha

Dark mode uses the Catppuccin Mocha palette. This is a deliberate choice, not a default - the colors are warm enough to feel human, muted enough to not strain eyes.

Toggle via a `dark` class on `<html>`, persisted to `localStorage`, falling back to `prefers-color-scheme: dark`.

```css
.dark {
  --bg-surface: #1e1e2e;
  --bg-sidebar: #181825;
  --bg-hover: #313244;
  --bg-active: #45475a;
  --bg-message: #313244;
  --bg-code: #181825;
  --bg-input: #313244;
  --border: #45475a;
  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
}
```

The accent color stays constant across both modes. The theme-color meta tag switches to `#1e1e2e` in dark mode.

### Semantic status colors

Don't create tokens for these - use them inline:

| State | Light bg | Light text | Dark bg | Dark text |
|-------|----------|-----------|---------|----------|
| Success/connected | `#22c55e` | - | `#a6e3a1` | - |
| Warning/reconnecting | `#f59e0b22` | `#d97706` | `#2a2520` | `#f9e2af` |
| Error | `#ef444422` | `#ef4444` | `#2a1a1f` | `#f38ba8` |

### Dynamic theme generation (optional)

For apps where users pick their own color (like Glopus), generate the full accent palette from a single hex value via HSL conversion:

```javascript
function applyThemeColor(hex) {
  const [h, s, l] = hexToHSL(hex);
  const dark = document.documentElement.classList.contains('dark');
  
  if (dark) {
    set('--c-50', hsl(h, s * 0.3, 14));
    set('--c-100', hsl(h, s * 0.3, 18));
    set('--c-300', hsl(h, s * 0.7, 72));
    set('--c-400', hsl(h, s * 0.6, 58));
    set('--c-500', hsl(h, s * 0.7, l));
    set('--c-600', hsl(h, s * 0.7, l - 8));
  } else {
    set('--c-50', hsl(h, s, 97));
    set('--c-100', hsl(h, s, 94));
    set('--c-300', hsl(h, s, 76));
    set('--c-400', hsl(h, s, 68));
    set('--c-500', hsl(h, s, l));
    set('--c-600', hsl(h, s, l - 8));
  }
}
```

## Typography

### Font stack

System fonts by default. Zero web font loads unless the app's identity requires it (Hebrew apps use Heebo, self-hosted as a variable font with `font-display: swap`).

```css
:root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
```

Monospace for technical content (tool labels, timestamps, code):

```css
font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
```

### Size scale

Not a rigid scale - sizes are tuned per context. But the range is consistent across apps:

| Size | Role |
|------|------|
| 1.5rem | Page headings (login, about) |
| 1.1-1.2rem | Section headings, app bar title |
| 0.95rem | Body text, nav items, input text |
| 0.85rem | Secondary text, sidebar items, card meta |
| 0.78-0.8rem | Banners, tool labels, small UI text |
| 0.7-0.75rem | Timestamps, date lines, tiny labels |

### Weights

Three weights: 400 (body), 500 (headings, nav items, labels), 600 (rare emphasis). Login headings can go to 300 for a light, inviting feel. Never use 700/bold in the UI chrome.

### Text treatment

- `font-variant-numeric: tabular-nums` on any time display or number column
- `text-overflow: ellipsis` + `white-space: nowrap` + `overflow: hidden` on titles in constrained spaces
- `-webkit-line-clamp` for multi-line truncation on card descriptions
- `letter-spacing: 0.04-0.08em` on uppercase micro-labels
- `white-space: pre-wrap` on user-generated content

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

- Width: 280px (flex-shrink: 0)
- Desktop (768px+ or 1024px+): always visible, static position
- Mobile: `position: fixed`, slides in from the start edge, `transform: translateX(-100%)` (or `translateX(100%)` for RTL)
- Transition: `transform 0.2s ease` (0.28s with `cubic-bezier(0.32, 0.72, 0, 1)` for a more organic feel)
- Scrim behind: `rgba(0, 0, 0, 0.4-0.5)`, opacity transition, z-index above content

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

## Components

### Chat bubbles

```css
.message {
  border-radius: 16px;
  padding: 8px 16px;
  max-width: 100%; /* 70% on desktop */
  word-wrap: break-word;
}

.message-user {
  background: var(--accent);
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 2px;
}

.message-assistant {
  background: var(--bg-message);
  color: var(--text-primary);
  align-self: flex-start;
  border-bottom-left-radius: 2px;
}
```

The 2px flat corner creates the speech-tail effect. Right-bottom for user (sent from this side), left-bottom for assistant (received from that side). In RTL apps, mirror these.

Message gap: 16px between bubbles. Font size: 1rem (0.875rem on smaller screens).

### Content cards

```css
.card {
  background: #fff; /* or var(--bg-surface) */
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px 18px 14px;
}

.card:hover {
  border-color: var(--accent-light, var(--accent));
}

.card:active {
  transform: scale(0.987);
}
```

Cards are the primary interaction surface in content apps. Keep padding generous. The press scale is subtle - just enough tactile feedback to feel responsive.

### Buttons

**Primary action (send, play):** Circular, 44px minimum, accent background, white icon.

```css
.btn-primary {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary:hover {
  filter: brightness(0.9);
}

.btn-primary:disabled {
  opacity: 0.4;
}
```

Large primary actions (play button in a player) go up to 70px.

**Ghost/icon buttons:** Transparent background, secondary text color, reveal on hover.

```css
.btn-icon {
  padding: 8px;
  border-radius: 8px;
  color: var(--text-secondary);
  background: transparent;
}

.btn-icon:hover {
  background: var(--bg-hover);
}
```

**Touch targets:** Every interactive element must be at least 44x44px. Use padding to expand small icons to this size. The button can look small but the tap area must be full-size.

### Text input

```css
textarea {
  border-radius: 16px;
  padding: 10px 16px;
  border: 1px solid var(--border);
  font-size: 1rem;
  line-height: 1.5;
  resize: none;
  max-height: 168px; /* ~7 lines */
}

textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  outline: none;
}
```

Auto-resize the textarea as the user types. On desktop, Enter sends; on mobile, Enter creates a newline (send via button).

### Date line separator

Used between message groups or content sections:

```css
.date-line {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.72rem;
  color: var(--text-secondary);
}

.date-line::before,
.date-line::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
```

### Status indicators

**Connection dot:** 8x8px circle. Green (`#22c55e`) = connected. Amber (`#f59e0b`) = reconnecting, with `pulse` animation (opacity 1 -> 0.4 -> 1, 1.5s infinite).

**Typing indicator:** Three 6x6px dots, bounce animation staggered by 0.2s. After 2 seconds, append "(Xs)" elapsed timer.

**Tool/loading rows:** Single-line monospace text. Green checkmark when done, accent spinner when active, secondary italic when waiting.

### Banners

Full-width, subtle tinted background, small text:

```css
.banner-warning {
  background: #f59e0b22;
  color: #d97706;
  padding: 6px 16px;
  font-size: 0.78rem;
  text-align: center;
}
```

### Spinners

Consistent spinner pattern everywhere:

```css
.spinner {
  width: 10px;
  height: 10px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
```

Scale up (24px) for page-level loading, down (10px) for inline indicators.

## Animations

### Principles

- Interactive feedback: subtle scale on press (0.92-0.99), 0.12s transition
- State transitions: 0.15-0.2s for hover, color, opacity changes
- Structural transitions: 0.2-0.28s for slide, transform (sidebar, drawers)
- Ambient/decorative: slow and organic, 8-12s cycles (breathing, pulsing)
- Always respect `prefers-reduced-motion`

### Standard animations

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### What NOT to animate

No page transitions or route animations. No entrance animations on content that's already loaded. No parallax. No skeleton screens - show the real content or nothing. The app should feel fast and direct, not theatrical.

## Shadows

All shadows use warm tones, never pure black:

```css
/* General shadow */
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);

/* Upward shadow (bottom-docked elements) */
box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.14);

/* Warm shadow variant (earth-tone apps) */
box-shadow: 0 4px 16px rgba(44, 24, 16, 0.18);
```

In dark mode, shadows need slightly higher opacity to remain visible against dark backgrounds.

## Icons

Inline SVG from Material Symbols Rounded glyph paths, never a web font and never emojis. Icon fonts leave controls blank until loaded. The paths are extracted from the `material-symbols` npm package using a Python script (`fonttools` + `SVGPathPen`), stored in an `icons.js` map, and rendered by an `Icon.svelte` component.

### Extraction tooling

Install `material-symbols` as a dev dependency. Use a script to extract glyph paths:

```bash
npm run icon play_arrow pause close   # extract specific icons
npm run icon                           # list currently bundled icons
```

The script (`scripts/icons.py`) uses `fonttools` to open the woff2, resolve ligature names via the GSUB rlig table, and extract SVG path data with `SVGPathPen`. Output is a JS map of `name: 'd-attribute'` pairs.

### Icon component

```svelte
<svg width={size} height={size} viewBox="0 0 960 960"
     fill="currentColor" aria-hidden="true">
  <path transform="translate(0 960) scale(1 -1)" {d} />
</svg>
```

The font uses 960 UPM with y-up coordinates; the transform flips to SVG's y-down. `fill="currentColor"` inherits the surrounding text color. `aria-hidden="true"` since icons are always decorative alongside text or within labeled buttons.

### Icon sizes

Follow a fixed set: 12, 14, 16, 20, 24, 40px. Don't use arbitrary sizes.

## RTL support

For Hebrew/Arabic apps:

- Set `<html lang="he" dir="rtl">` and `"dir": "rtl"` in the manifest
- Force `direction: ltr` on: progress bars, transport controls, time displays, numeric sequences
- Use logical properties where possible: `inset-inline-start`, `margin-inline-start`, `border-inline-end`
- Directional icons (back arrows, send arrows) need `scaleX(-1)` - design the raw SVG for the primary direction, flip for the other
- The sidebar slides from the start edge (left in LTR, right in RTL)

## Prose/markdown rendering

For apps that render markdown content (chat messages, articles):

```css
.prose {
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
}

.prose p { margin: 0.4em 0; }
.prose p:first-child { margin-top: 0; }
.prose p:last-child { margin-bottom: 0; }

.prose ul, .prose ol { padding-left: 1.5em; }
.prose li + li { margin-top: 0.2em; }

.prose h1, .prose h2, .prose h3 { font-weight: 600; }
.prose h1 { font-size: 1.2em; }
.prose h2 { font-size: 1.1em; }
.prose h3 { font-size: 1.05em; }

.prose blockquote {
  border-left: 3px solid var(--border);
  padding-left: 12px;
  color: var(--text-secondary);
}

.prose pre {
  background: var(--bg-code);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 0.85rem;
  overflow-x: auto;
}

.prose code {
  background: var(--bg-code);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 0.88em;
}

.prose a {
  color: var(--accent);
  text-decoration: underline;
}
```

In user bubbles (accent background), override all text to white and all backgrounds to translucent white (`rgba(255, 255, 255, 0.2)`).

Reset Tailwind Typography's font-family, font-size, and line-height back to `inherit` so markdown content matches the surrounding UI.

## Boot sequence

The single biggest feel item. The app must never render a state it will immediately replace - no login flash for returning users, no light-mode flash, no empty-list flash.

1. **Dark mode class applied before first paint.** Read `localStorage.getItem('darkMode')` in an inline `<script>` in `<head>`, toggle the `dark` class, and set the `theme-color` meta tag. This runs before any CSS paints.

2. **Auth state read synchronously.** Read the credential from localStorage before any async work. If it exists, show a splash (app icon, centered, on the surface color) while re-validating against the server. Only show the login page if there's no stored credential or validation fails.

3. **Restore last state before flipping authenticated.** Load the last conversation ID, settings, and any other persisted state. Show the UI only after state is ready - not before.

4. **Delayed `--vh` recalculations.** Set `--vh` immediately, then again at 100ms and 300ms after load to catch mobile browser chrome settling.

The goal: a returning user sees the app in the correct theme with their last conversation, never a white flash or a login form that disappears.

## Auth

### PIN-based (single-user apps)

The PIN is the credential, not a session. Raw PIN stored in `localStorage['pin']`, replayed on every connection. No token exchange, no expiry, no cookies. This is correct for single-user apps and eliminates session-refresh bugs entirely.

Transport: send the PIN in an `{ type: 'auth', pin }` message over WebSocket, or as an `x-pin` header for fetch requests. For EventSource (which can't set headers), use `?pin=` query parameter.

Login UI: `<input type="password" inputmode="numeric" pattern="[0-9]*">`, digits-only sanitization (`value.replace(/\D/g, '')`), autofocus, submit disabled under 4 digits.

Every app must have a logout affordance that clears the credential and drops to login. Any fetch wrapper should handle 401 by clearing the stored PIN and showing login.

### Google OAuth (multi-user apps)

Use Google Identity Services popup flow, never redirect - so the URL and any hash deep links survive sign-in. Configure with `auto_select: true` for silent re-auth on return visits.

Decode the JWT payload on the client (`atob(credential.split('.')[1])`) and store only `{ id, name, email, picture }` in localStorage. POST the raw `id_token` to `/api/auth` fire-and-forget to upsert the server-side user record. Server does full RS256 verification against Google's cached certs.

Dev bypass: detect localhost and preview subdomains by hostname, auto-sign-in with a hardcoded dev user. Never match production hostnames.

## Settings

### Storage split

- Device preferences (dark mode): `localStorage` only, applied on boot
- Identity settings (name, icon, theme color): server via `PATCH /api/config`, loaded after auth

Dark mode toggle lives in the sidebar footer, not on the settings page.

### Settings page structure

White cards with rounded corners and subtle shadow. Each card has a header row in `0.875rem` weight-500 secondary text. Content sections stacked with `space-y` gap.

**Color picker:** 8-10 preset swatches as 32px circles (`border-2`, selected gets `border-gray-800 scale-110`), plus a custom swatch - dashed border circle with a hidden `<input type="color">` at `absolute inset-0 opacity-0`. Apply the color live on selection; save explicitly.

**No toggle switches.** Every binary option is a button that changes its label and icon (e.g. "Dark mode" with moon icon toggles to "Light mode" with sun icon). This is simpler and already the house style.

**Status messages are inline, not toasts.** Show them adjacent to the action that caused them. Auto-clear: 3000ms for saves, 5000ms for test results.

## Scroll and overscroll

### Structural scroll control

The app shell itself never scrolls - `html, body { overflow: hidden }`, app root at `100dvh`. Each view has exactly one inner element with `overflow-y: auto`.

For chat apps where pull-to-refresh would interfere with the scrolled message list, add `overscroll-behavior-y: none` on the scroller. Same for player views and any fixed-layout screen.

For content apps (library, feed, settings), pull-to-refresh is useful - don't suppress it. The structural approach (document doesn't scroll, inner element does) already prevents accidental triggers during mid-scroll; only a deliberate pull from the top fires it.

## Caching and updates

### Service worker strategy

Network-first for everything, cache only as offline fallback. `skipWaiting()` on install, `clients.claim()` on activate. This means the latest code always wins and the cache only matters when offline.

**Never cache media.** Audio/video elements issue no-cors range requests; the SW sees opaque responses that can't be sliced, so caching breaks seeking. Serve media with `Cache-Control: public, max-age=31536000, immutable` from R2 instead.

**Never cache theme-dependent assets.** Exclude favicon, app icons, and manifest from the SW because they change with the user's theme color.

### Update flow

Two patterns by app type:

**Content apps (Pages, static):** Use vite-plugin-pwa with `registerType: 'autoUpdate'` plus `controllerchange -> location.reload()`. Silent and seamless.

**Chat apps (Worker-backed):** Build-hash polling. Vite injects `__BUILD_HASH__` at build time. Client polls `/api/version` at load+10s then every 5 minutes. On mismatch, show an amber "Update available" pill in the header. User taps to reload - never force-reload mid-conversation.

**Every app** gets a hard-reload escape hatch in the kebab menu: unregister all SWs, delete all caches, reload. Eight lines, universal "the app is being weird" fix.

## Keyboard and input

### Virtual keyboard

The viewport meta `interactive-widget=resizes-content` plus `100dvh` handles keyboard resize declaratively. The layout viewport shrinks when the keyboard opens; no JS needed.

### Textarea auto-resize

```javascript
function autoResize() {
  el.style.height = 'auto';
  const clamped = Math.min(el.scrollHeight, 168);
  el.style.height = clamped + 'px';
  el.style.overflowY = el.scrollHeight > 168 ? 'auto' : 'hidden';
}
```

Max height: 168px (~7 lines). Don't use 50vh - it eats the conversation on phones.

### Draft persistence

Any text input that would hurt to lose gets persisted to localStorage. Save on input (debounce 300ms). Restore on return. Clear on submit. Nothing typed is ever lost.

For chat apps: per-conversation drafts under `appname.draft.{conversationId}`. For forms/journals: per-field or per-view drafts. The key naming follows localStorage discipline: versioned prefix per app (`appname.key.v1`).

### Focus management

Use `on:mousedown|preventDefault` on any button that must act before an input's blur fires (e.g. a rename Save button). Don't refocus the textarea after send on mobile - the keyboard dropping is correct.

## Navigation

### Hash router

Use a hash router by default. It makes the browser back button work and deep links survive app restarts from the home screen. A tiny hand-rolled one is fine - no library needed.

Key refinements:
- Use `history.replaceState` for sequential navigation within a list (e.g. skipping through items) so five skips don't leave five history entries
- `back()` should fall back to the default route when `history.length <= 1` so a cold deep link doesn't strand the user
- Guard against dead links by redirecting unknown IDs home
- Close the sidebar/drawer on any navigation

At minimum, even apps without a router need: a history entry per overlay so the back button closes drawers/menus/lightboxes instead of exiting the app.

### Standalone link handling

When running as an installed PWA, external links should open in the system browser:

```javascript
if (window.matchMedia('(display-mode: standalone)').matches) {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (a && a.hostname !== location.hostname) {
      e.preventDefault();
      window.open(a.href, '_blank');
    }
  });
}
```

## Chat / realtime apps

This section applies to apps with a persistent server connection and streaming responses - companion chatbots, collaborative tools, anything with a WebSocket. Skip it for static content apps.

### Transport: WebSocket

Use a single WebSocket connection, not SSE. WebSocket supports bidirectional messaging (auth, ping/pong, send, stream) over one connection. Auth via `{ type: 'auth', pin }` on open; the server stores `authed` state on the connection.

### Connection state machine

Named states: `disconnected -> connecting -> connected -> reconnecting -> connecting`. Render as the 8px status dot (green = connected, amber pulse = reconnecting) plus a banner for error states.

### Reconnection

This is what separates "works" from "feels native."

1. **`visibilitychange` is the primary reconnect trigger on mobile.** On becoming visible, cancel pending backoff timers and reconnect immediately. Mobile Chrome throttles background timers to 60s+; without this, every app-switch-back shows a dead connection for a minute.

2. **`online`/`offline` events for instant honesty.** `offline` force-closes the socket and shows reconnecting immediately. `online` resets backoff to 1s and reconnects now. Fastest possible signal, faster than any heartbeat.

3. **Heartbeat with a tight deadline.** Ping every 10s, pong deadline 5s. A silent connection drop surfaces in 15s worst case.

4. **The server keeps streams alive regardless of connection state; the client catches up.** On reconnect after successful auth, the server sends active stream snapshots. Events carry a monotonic sequence number; the client drops `seq <= lastSeen`, making snapshot + live replay idempotent.

5. **Exponential backoff.** Start at 1s, double each attempt, cap at 30s. Reset to 1s on successful auth.

### Send path integrity

**Optimistic insert.** Insert the user's message into the UI immediately with a temporary ID (descending negative integers or `tmp-${uuid}`). Reconcile against the server's real ID so the keyed `{#each}` doesn't remount the DOM element.

**Never eat a message.** On total send failure: restore the text to the textarea and re-save the draft. The user must never lose what they typed. Before retrying a send, re-fetch server messages first - if the server already has it, sync instead of double-sending.

**Double-tap protection.** A synchronous `sending` lock prevents duplicate sends from fast taps. Without it, two conversations can be created from one first message.

**Stop during streaming.** If the user stops generation during the initial response, pop the message, delete it server-side, and restore the text to the textarea for editing.

### Enter key behavior

Detect mobile: `window.matchMedia('(max-width: 1024px)').matches || 'ontouchstart' in window`.

- **Mobile:** Enter always inserts a newline. Send is button-only.
- **Desktop:** Enter sends. Shift+Enter inserts a newline (native behavior). Alt+Enter inserts a newline at cursor position (splice at `selectionStart`, restore caret to `start + 1` after `tick()`, re-run autoresize).

### Chat scrolling

- Auto-scroll to bottom on new message content unless the user has scrolled up more than **100px** from the bottom
- Sending always force-scrolls to bottom and resets the scrolled-up flag
- Scroll after DOM update: `await tick(); scrollToBottom()`
- Use hard `scrollTop = scrollHeight`, never smooth scroll (smooth fights streaming)
- Add `overscroll-behavior-y: none` on the messages scroller

### Attachments

**Image upload:** Resize on the client before uploading - canvas resize to max dimension 1568px, JPEG quality 0.85, iterate quality down to 0.3 until under 4MB. Upload immediately on selection with send blocked while uploading.

**Paste handling:** Image pastes from clipboard become attachments. Long text pastes (>200 chars or >3 lines) become a collapsible chip rather than flooding the textarea. Short pastes go inline.

Wire format: wrap attached content in pseudo-XML tags (`<attached-file name="...">...</attached-file>`, `<pasted-content>...</pasted-content>`), stripped back out for display.

## Install prompts

### Capture early

Capture `beforeinstallprompt` in an inline `<script>` in `index.html` before the bundle loads:

```javascript
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
});
```

Capturing in a component listener risks mounting too late and missing the event.

### Trigger on engagement

Show the install nudge only after demonstrated engagement (e.g. 10 seconds of playback, or after the first conversation). Never show in standalone mode. Dismiss on `appinstalled`.

Dismissal is session-only - the lasting "stop showing" is having actually installed.

### Standalone detection

```javascript
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;
```

### The slide-in tip pattern

A lower-third banner that slides in from the edge, not a modal. Implementation from Yael's app:

- Position: `absolute`, anchored near the bottom above any player/nav bar
- Entrance animation: slide from offscreen with `cubic-bezier(0.22, 1, 0.36, 1)` over 0.5s, opacity fade-in at 60%
- Frosted or semi-opaque background in the app's accent color
- Expandable: tap to reveal platform-specific install instructions
- For Android: one tap calls `installPrompt.prompt()` if the deferred event exists
- For iOS (detect via `/(iPad|iPhone|iPod)/.test(navigator.userAgent)`): expand to show manual instructions with the share icon glyph and "Add to Home Screen" text
- Compact enough to not obstruct the main content
- Auto-dismiss after install; session-dismiss on close

## Push notifications

### Setup flow

1. Fetch VAPID public key from the server
2. `Notification.requestPermission()`
3. `navigator.serviceWorker.ready` -> `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` with base64url-to-Uint8Array conversion
4. POST the subscription object to the server

### Service worker handler

Parse `event.data.json()` with a text fallback. Include `icon: '/icon-192.png'`, `badge: '/badge-72.png'` (72px monochrome glyph for Android status bar - easy to forget), and `vibrate: [200, 100, 200]`.

On `notificationclick`: find an existing window with `clients.matchAll()` and focus it, or `clients.openWindow()`. Deep-link via `/?chat=<id>`, consumed on boot then cleaned with `history.replaceState`.

Server: use `web-push`, fan out to all stored subscriptions. Self-heal by deleting subscriptions that return 404/410.

Include a "Send test notification" button in settings - it's how you debug the entire chain.

## Audio and media (for media apps)

### Architecture

One `<audio>` element owns everything - lock screen controls, MediaSession, OS play/pause. If the app has video items, encode them as muted mp4s (no audio track) that follow the audio's clock. Browsers kill backgrounded `<video>` but keep `<audio>` alive with lock screen controls.

### MediaSession

Set metadata (title, artist, album, artwork) and handlers for play/pause/previoustrack/nexttrack/seekbackward/seekforward/seekto. Wrap each handler registration in try/catch - old browsers throw on unknown actions. Call `setPositionState()` so the lock screen scrubber shows position.

### The wanted flag

Track user intent separately from element state. On an unexpected pause while `document.hidden` and `wanted === true`, attempt to resume - the OS may have paused it, and a single `play()` call often recovers it.

On `visibilitychange` to visible, call `resync()` to resume if needed and sync video to audio.

### Position persistence

Save playback position every 5000ms while playing, plus on pause/ended/seek, plus `flush()` on `pagehide`. Don't resume from the first 10 seconds (likely just started). Treat "within 20s of the end" as complete. Apply saved position at `loadedmetadata` - setting `currentTime` before duration is known is silently ignored.

Set `preload='metadata'` on create, upgrade to `'auto'` inside `play()`.

### Decorative sounds

Play UI sounds (bells, notifications) through the Web Audio API, never a second `<audio>` element. The main element must keep exclusive ownership of MediaSession.

## Date & time formatting

Never show raw ISO strings to users. Format dates for the context.

### Patterns by context

| Context | Format | Example |
|---------|--------|---------|
| Admin lists, cards, metadata | dd/mm/yyyy | 14/08/2026 |
| User-facing Hebrew dates | Intl day + month (he-IL) | 14 באוגוסט |
| User-facing Hebrew dates, other year | Intl day + month + year | 14 באוגוסט 2025 |
| Recent events | Intl.RelativeTimeFormat | לפני 3 שעות, אתמול |
| Duration / playback time | m:ss | 8:55 |
| Remaining time | m:ss with label | נשארו 3:42 |

### Rules

- Store dates as ISO 8601 in the database (`2026-08-14`, `2026-08-14T20:32:00Z`).
- Admin/internal UIs use numeric dd/mm/yyyy - compact and scannable.
- User-facing apps use Hebrew prose dates via `Intl.DateTimeFormat('he-IL')` - warmer and more natural.
- Duration is always `m:ss`: no leading zero on minutes, zero-padded seconds.
- Use `font-variant-numeric: tabular-nums` on any time or date display to prevent layout jitter.
- For relative times, use a ladder: just now / Xm / Xh / yesterday / Hebrew date. `Intl.RelativeTimeFormat('he', { numeric: 'auto' })` handles the Hebrew naturally.

### Shared helpers

Extract date/time formatting into a shared module per project so every component renders consistently. Don't inline ad-hoc formatting.

## Timing constants

These are the house timing signature. Use them consistently.

### General

| Constant | Value | Purpose |
|----------|-------|---------|
| Save status auto-clear | 3000ms | Settings save confirmations |
| Test status auto-clear | 5000ms | Test notification confirmations |
| Error auto-clear | 8000ms | Error messages (guard: check message hasn't changed) |
| Update poll initial | 10s | First version check after load |
| Update poll interval | 5min | Subsequent version checks |
| Draft save debounce | 300ms | Input draft persistence |
| Position save interval | 5s | Audio playback position persistence |

### Chat / realtime

| Constant | Value | Purpose |
|----------|-------|---------|
| Elapsed timer delay | 2s | Show "(Xs)" only after 2 seconds of waiting |
| Stall detection | 1500ms | Show "Working..." when no stream progress |
| Heartbeat interval | 10s | WebSocket ping |
| Heartbeat timeout | 5s | Pong deadline |
| Reconnect backoff start | 1s | Initial reconnect delay |
| Reconnect backoff cap | 30s | Maximum reconnect delay |

## Small patterns that are pure feel

- `@media (hover: none)` to make hover-revealed actions always visible on touch devices
- `dir="auto"` on textareas, titles, and prose blocks for bilingual users
- RTL islands: `direction: ltr` forced on progress bars, timecodes; `tabular-nums` on all timecodes to prevent RTL jitter
- Inline SVG icons from path data, never a web font - icon fonts leave controls blank until loaded
- Relative timestamp ladder: just now / 5m / 3h / 2d / 2w / 6mo / full date
- localStorage key discipline: use a versioned prefix per app (`appname.key.v1`), not bare keys like `pin` or `darkMode`

## Deployment

### Worker-backed apps

Single Cloudflare Worker with `wrangler.jsonc`:

```json
{
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/ws"]
  }
}
```

Those two lines make a routerless SPA and a WebSocket upgrade coexist with the static asset layer. Add D1 bindings, a named Durable Object (`idFromName('appname')` for single-user), and a custom domain route.

### Pages apps

`pages_build_output_dir` in wrangler config. Server functions in `functions/api/` with `onRequestGet/Post`. D1 binding for data, R2 (over HTTPS from a custom domain, not a binding) for large media. Every branch gets a preview deploy, which the auth dev-bypass hostname check depends on.

## Accessibility minimum

The existing apps have the basics (44px targets, `prefers-reduced-motion`, semantic buttons) but not much more. The skill mandates at minimum:

- [ ] Focus trap in drawers and modals (Tab stays inside, Escape closes)
- [ ] `aria-live="polite"` on streaming message regions and status banners
- [ ] Focus returned to the trigger element after modal/drawer close
- [ ] Visible focus indicators (the `:focus` ring from the textarea section works everywhere)
- [ ] `role="status"` on connection state indicators

## What this style is NOT

- Not a design system with 47 components and a Figma file. Each app has 3-7 Svelte files and zero shared component imports.
- Not Tailwind-dependent. CSS custom properties are the theming layer. Use Tailwind utilities if you want, but the theme must work without them.
- Not dark-mode-optional. Every app that isn't a single-brand identity piece (like Yael's meditation app) ships with Catppuccin Mocha dark mode.
- Not image-heavy. These apps are text, color, and typography. No illustrations, no stock photos, no avatars (unless the user provides one). Visual hierarchy comes from weight, size, and color - not from graphics.
- Not over-animated. One ambient animation per app at most. Everything else is quick feedback transitions.

## Checklist

Before shipping a PWA, verify:

**Shell and PWA:**
- [ ] Viewport meta with all five attributes
- [ ] Apple meta tags (capable, status-bar-style)
- [ ] Dynamic theme-color meta tag (updates with dark mode)
- [ ] Manifest with proper icons including maskable
- [ ] Service worker with network-first strategy
- [ ] Safe area variables used in top/bottom bars
- [ ] `100dvh` height with `--vh` JS fallback
- [ ] Dark mode applied before first paint (inline script)
- [ ] No login flash for returning users (splash while validating)
- [ ] External links open in system browser when installed
- [ ] Install prompt captured in index.html inline script
- [ ] Hard-reload escape hatch in menu

**Visual:**
- [ ] Touch targets >= 44px on all interactive elements
- [ ] `prefers-reduced-motion` respected
- [ ] Dark mode toggle persisted to localStorage
- [ ] Scrollbar styled for dark mode
- [ ] No horizontal overflow on any screen size
- [ ] `@media (hover: none)` for touch-revealed actions
- [ ] `dir="auto"` on user-generated content

**Behavioral (chat apps):**
- [ ] Enter sends on desktop, newline on mobile
- [ ] Draft persistence per conversation
- [ ] Optimistic message insert with temp IDs
- [ ] Send failure restores text to textarea
- [ ] Double-tap send protection
- [ ] Auto-scroll unless user scrolled up > 100px
- [ ] Visibility-based reconnect
- [ ] Online/offline event handlers
- [ ] Heartbeat with tight deadline (10s ping, 5s pong timeout)
- [ ] Exponential backoff (1s start, 30s cap)
- [ ] Build-hash version polling

**Behavioral (media apps):**
- [ ] Single `<audio>` element owns MediaSession
- [ ] Lock screen controls (play/pause/prev/next/seek)
- [ ] Position persistence (save every 5s + on pause/ended)
- [ ] Background playback survives `document.hidden`
- [ ] `overscroll-behavior-y: none` on player

**Accessibility:**
- [ ] Focus trap in drawers/modals
- [ ] `aria-live` on streaming regions
- [ ] Focus return after modal close
- [ ] Visible focus indicators
- [ ] Escape closes overlays

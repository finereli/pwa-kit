# Accessibility minimum and ship checklist

## Accessibility minimum

The existing apps have the basics (44px targets, `prefers-reduced-motion`, semantic buttons) but not much more. The skill mandates at minimum:

- [ ] Focus trap in drawers and modals (Tab stays inside, Escape closes)
- [ ] `aria-live="polite"` on streaming message regions and status banners
- [ ] Focus returned to the trigger element after modal/drawer close
- [ ] Visible focus indicators (the `:focus` ring from the textarea section works everywhere)
- [ ] `role="status"` on connection state indicators

## Checklist

Before shipping a PWA, verify:

**Shell and PWA:**
- [ ] Viewport meta with all attributes (kit `shell/index.html`)
- [ ] Apple + mobile-web-app meta tags, apple-touch-icon
- [ ] theme-color meta (dynamic if the app has dark mode)
- [ ] Manifest with proper icons including maskable
- [ ] Update flow verified with two builds (kit `updates/README.md` recipe)
- [ ] `canReload` veto wired for the app's sensitive moment (audio, upload, stream)
- [ ] Reload icon + build number in the drawer; `/reset.html` reachable past the worker
- [ ] Safe area variables used in top/bottom bars
- [ ] Fixed shell (`#app { position: fixed; inset: 0 }`, no viewport units), body `overflow: hidden`, one scroller per view
- [ ] Installed on Android with 3-button navigation: bottom bar above the buttons, keyboard open and closed
- [ ] Dark mode applied before first paint (inline script), if the app has dark mode
- [ ] No login flash for returning users
- [ ] External links open in system browser when installed
- [ ] Install prompt captured in index.html inline script
- [ ] Sign-in is finereli login (kit `login/`) unless the app needs its own Google client; the Worker's `audience` lists only the app's origins
- [ ] Own-client apps only: dev auth bypass double-locked (host AND `DEV_AUTH`); previews bind preview D1/R2
- [ ] `kit.py status <project>` shows every kit file `current`

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
- [ ] `canReload: () => !streaming` so an update never reloads mid-answer

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

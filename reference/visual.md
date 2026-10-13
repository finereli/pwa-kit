# Visual: color, typography, components, animation, shadows, icons, prose

## Color system

Every app defines its palette through CSS custom properties. The token names are semantic, not color-named.

### The token set

These are the names the kit's shared components reference. An app defines the values in `:root` (kit `shell/css/base.css`) and, if it has dark mode, again under `.dark`. Re-skinning is redefining the accent triple; the neutrals are the family resemblance.

```css
:root {
  /* identity */
  --accent: …;          /* buttons, links, the lit update icon */
  --accent-deep: …;     /* top bar, login background, hover of primary */
  --accent-light: …;    /* subtitles on accent surfaces */
  --accent-soft: …;     /* tinted surface for selected/current rows */
  /* neutrals */
  --bg-surface: …;      /* page */
  --bg-raised: …;       /* cards, inputs */
  --bg-hover: …;        /* hover, selected, disabled fill */
  --text-primary: …;
  --text-secondary: …;  /* timestamps, labels, meta */
  --border: …;
  /* semantic */
  --ok: …;  --danger: …;  --danger-deep: …;
  --radius: 10px;
  --shadow: …;
  --safe-top / --safe-bottom (env)
}
```

Chat apps add `--bg-message`, `--bg-code`, `--bg-input`, `--bg-sidebar` as needed. Don't pre-define tokens you don't use. An app that already has its own palette names (Yael's `--cream/--brown/--mid/--sand`) keeps them and adds an alias block mapping the kit names onto them; shared components stay untouched.

### Dark mode: Catppuccin Mocha

Apps with dark mode (the chat apps) use the Catppuccin Mocha palette. Warm enough to feel human, muted enough to not strain eyes. Single-identity apps (Yael's) ship light-only; that's a profile, not a failing.

Toggle via a `dark` class on `<html>`, persisted to `localStorage`, falling back to `prefers-color-scheme: dark`.

```css
.dark {
  color-scheme: dark;   /* native controls: time picker icon, scrollbars */
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

`color-scheme` must flip with the class: without it, native controls (the clock in `<input type="time">`, scrollbars, autofill) stay drawn for light mode, black on dark. The accent color stays constant across both modes. The theme-color meta tag switches to `#1e1e2e` in dark mode.

### Semantic status colors

Don't create tokens for these - use them inline:

| State | Light bg | Light text | Dark bg | Dark text |
|-------|----------|-----------|---------|----------|
| Success/connected | `#22c55e` | - | `#a6e3a1` | - |
| Warning/reconnecting | `#f59e0b22` | `#d97706` | `#2a2520` | `#f9e2af` |
| Error | `#ef444422` | `#ef4444` | `#2a1a1f` | `#f38ba8` |

### Dynamic theme generation (optional)

Kit: `theme/`. For apps where users pick their own color (like Glopus), generate the full accent palette from a single hex value via HSL conversion:

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

Kit: `icons/` (Icon.svelte, extraction script). Inline SVG from Material Symbols Rounded glyph paths, never a web font and never emojis. Icon fonts leave controls blank until loaded. The paths are extracted from the `material-symbols` npm package using a Python script (`fonttools` + `SVGPathPen`), stored in an `icons.js` map, and rendered by an `Icon.svelte` component.

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

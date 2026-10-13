# Behavior: boot, sync, auth, settings, keyboard, navigation, install, dates, timing

## Boot sequence

The single biggest feel item. The app must never render a state it will immediately replace - no login flash for returning users, no light-mode flash, no empty-list flash.

1. **Dark mode class applied before first paint** (apps with dark mode). Read the stored preference in an inline `<script>` in `<head>`, toggle the `dark` class, and set the `theme-color` meta tag. This runs before any CSS paints. (The chat apps this was extracted from actually toggle in `onMount` and flash; do it the right way. Snippet in `kit/theme/lib/theme.js`.)

2. **Auth state read synchronously.** Read the credential from localStorage before any async work. If it exists, show a splash (app icon, centered, on the surface color) while re-validating against the server. Only show the login page if there's no stored credential or validation fails.

3. **Restore last state before flipping authenticated.** Load the last conversation ID, settings, and any other persisted state. Show the UI only after state is ready - not before.

The goal: a returning user sees the app in the correct theme with their last conversation, never a white flash or a login form that disappears.

## Data stores: load at boot, read synchronously

For management/admin apps whose whole dataset is small (hundreds of rows, not millions), stores fetch everything once at boot - in parallel, right after auth - and every view after that is a synchronous read from memory. Opening a detail view must never fire its own fetch: `store.byId(id)` and render, no loading state, no half-second blink. Discovered on Yael's posting board: the items editor opened instantly (store read) while the post editor took ~500ms (per-open `GET /api/posts/:id`), and the difference was glaring.

- **Normalize, don't duplicate.** A relation loads once as its own store or map (e.g. all `post_groups` rows as `{ post_id → [{group_id, posted_at}] }`) and views join it with the registries they already have (names, links come from the groups store). Detail endpoints that re-join and re-ship data the client already holds get deleted.
- **Derive, don't denormalize.** Counts and badges ("12/18 posted", "done") are computed from the loaded relation, not stored as columns the client must keep in sync.
- **Mutations update the store optimistically** (see Optimistic updates); derived views re-render for free.
- **A per-entity fetch is still right** when the payload is genuinely heavy per entity (transcripts, media, analytics) - then render everything you have from the store instantly and stream the heavy part in below it, never blocking the whole view.

## Sync for local-first apps

For an app that keeps its whole dataset on the device (100 Shots) and adds sign-in for sync. 100 Shots is the reference (`src/lib/merge.ts`, `src/lib/sync.svelte.ts`, `worker/index.ts`).

- **Send everything, keep the merge.** `POST /api/sync` carries the device's whole dataset; the Worker merges it with the stored copy (one JSON row per `sub`), stores and returns the merge; the device merges that with whatever changed while the request was out, and syncs again if anything did. Fine while a person's data is kilobytes, which for a tracker is years.
- **The merge is a pure function shared by app and Worker**, and order-free: A into B keeps what B into A keeps, and merging twice changes nothing. Then sync has no conflicts to resolve and a lost race heals on the next sync.
- **Ids are UUIDs made on the device. Deletes leave tombstones** (`id -> when`), or the other device brings the item back.
- **Undo must beat the delete it undoes**, even if the delete already reached the server: a restored item gets `t = now` and lives if `t` is newer than its tombstone. Timing tricks (wait out the undo window before syncing) are not enough.
- **Edits to a field are last-writer-wins on a per-field stamp** (`nameAt`).
- **Sync triggers:** start, a moment (1.5s) after each edit, `visibilitychange`, `online`. Show a quiet status line (Synced / Syncing / Offline, will sync later), never a modal.
- **Signing in merges, never replaces:** what the device logged signed out is kept.
- **Signing out syncs first, then clears the device**, so the next person starts empty. If the sync fails, don't sign out; say the data is still on the device.

## Auth

### PIN-based (single-user apps)

The PIN is the credential, not a session. Raw PIN stored in `localStorage['pin']`, replayed on every connection. No token exchange, no expiry, no cookies. This is correct for single-user apps and eliminates session-refresh bugs entirely.

Transport: send the PIN in an `{ type: 'auth', pin }` message over WebSocket, or as an `x-pin` header for fetch requests. For EventSource (which can't set headers), use `?pin=` query parameter.

Login UI: the `pin-auth` kit item is the reference implementation - a phone-style keypad with PIN dots that auto-submits at length, shakes and clears on a wrong PIN, and accepts desktop keyboard input (digits, numpad, Backspace) via a window listener with no focus management. Fall back to a plain `<input type="password" inputmode="numeric" pattern="[0-9]*">` only where the keypad doesn't fit.

Every app must have a logout affordance that clears the credential and drops to login. Any fetch wrapper should handle 401 by clearing the stored PIN and showing login.

### finereli login (the default for multi-user apps)

Kit: `login/`. Every app signs in through login.finereli.com (repo finereli/finereli-login), which holds the one Google OAuth client. **A new app does not get a Google Cloud project, an OAuth client or a secret.** An app on `*.finereli.com` works with no setup at all; another domain is one entry in that service's `ALLOWED_ORIGINS`. The app holds no keys.

The app opens the service in a popup, gets a one-time code back on its own origin, and trades it for a 90-day ES256 token whose audience is the app's origin. Its Worker checks the token against the service's public key (`verifyLogin`) and keys data on `user.sub`, the Google account id. A second app in the same browser signs in without seeing Google. Tokens slide (refreshed daily while the app is used). Details and decisions: `kit/login/README.md`.

Local dev needs no bypass: localhost is an allowed origin, so the real sign-in works there, and the Worker's `audience` lists `http://localhost:5173` beside production.

Signing in can be optional. A local-first app works signed out and signing in only adds sync (see Sync for local-first apps).

The rules under the next heading for 401s, account switches and server-derived users apply here too: `makeApi(login)` is the 401 funnel, `login.onChange` resets per-user stores, and the Worker takes the user from the verified token, never from the request body.

### Own Google client (apps that need more than identity)

Use this only when finereli login doesn't fit: the app needs Google scopes beyond sign-in (Drive, Calendar, Gmail), it belongs to someone else (a client's app), or it must show its own brand on Google's screen. Existing apps on it (Yael's app/admin, Ajde) can move to finereli login without losing users, because `sub` is the same Google account id under any client.

Kit: `auth/` (client class, token verification, sessions, `/api/auth`, middleware, schema, Login). Use it; this is the part with the most ways to be subtly wrong. The Google project and client come from the `google-oauth-setup` skill.

Google Identity Services popup flow, never redirect, so the URL and any hash deep links survive sign-in. `auto_select: true` for silent re-auth on return. One Tap first, popup fallback when it's not displayed or skipped.

**The Google ID token is not the credential.** It lives about an hour, which used to log people out on every update. `POST /api/auth` verifies it (RS256 against Google's cached certs, audience = your client id), upserts the user, and answers with a `sess_<64 hex>` token stored in a D1 `sessions` table, 90 days, revocable by deleting the row. That session is what every later request carries as `Bearer`. If the server is unreachable at sign-in, the client still signs in from the decoded token; the first API call that needs the server 401s and re-prompts.

**401 handling is one funnel.** The app's `api()` wrapper (kit `api/`) sends every 401 to `auth.handleUnauthorized()`: clear the stored user, notify listeners, `google.accounts.id.prompt()`. With auto-select that's usually seamless.

**Per-user stores reset on account switch.** `auth.onChange(fn)`; every store holding per-user data (journal, settings) clears and reloads. Without it a shared device shows the previous person's entries.

**Server derives the user from the session, never from client-supplied ids.** The journal API once took `?google_id=` and any user could read anyone's private journal. Middleware sets `context.data.user`; handlers use that.

**Store rules for auth-backed data:** guard `res.ok`; on failure keep `loading = true` (a spinner, not a fake-empty list); reset the loaded flag on auth change so it refetches after re-auth; never call `.filter()` on an error body.

**Dev bypass is double-locked.** The client auto-signs-in a dev user on localhost and on the app's `*.pages.dev` preview suffix. The server accepts `dev-token` only when the host is local/pages.dev AND the `DEV_AUTH` env var is set (`.dev.vars` locally, `[env.preview.vars]` for previews). Hostname alone is not an auth boundary: previews once bound the production database, and any preview URL was full admin access. Previews get their own D1/R2 (see deployment.md).

Admin apps: `is_admin` column on users, middleware refuses non-admin sessions with 403.

## Settings

### Storage split

- Device preferences (dark mode): `localStorage` only, applied on boot
- Identity settings (name, icon, theme color): server via `PATCH /api/config`, loaded after auth

Dark mode toggle lives in the sidebar footer, not on the settings page.

### Settings page structure

White cards with rounded corners and subtle shadow. Each card has a header row in `0.875rem` weight-500 secondary text. Content sections stacked with `space-y` gap.

**Color picker:** 8-10 preset swatches as 32px circles (`border-2`, selected gets `border-gray-800 scale-110`), plus a custom swatch - dashed border circle with a hidden `<input type="color">` at `absolute inset-0 opacity-0`. Apply the color live on selection; save explicitly.

**No toggle switches.** Every binary option is a button that changes its label and icon (e.g. "Dark mode" with moon icon toggles to "Light mode" with sun icon). This is simpler and already the house style.

**Status messages are inline, not toasts.** Show them adjacent to the action that caused them. Auto-clear: 3000ms for saves, 5000ms for test results. (Failed optimistic mutations are the exception - they have no message anchor; see Save model → Optimistic updates.)

## Save model

Kit: `save/` (SaveTracker, SaveStatus, AutoTextarea).

**Autosave-first.** Editing surfaces save on a debounce (800ms) and on blur; there is no save button to forget. Discovered the hard way: a form that discards on back is a data-loss hole nobody reports, they just retype.

- **The server is the draft store.** No localStorage draft layer for autosaved fields; that would be a third state nobody can see or reason about. (Draft persistence to localStorage is for chat composers and journal entries where the send is explicit; see Keyboard and input.)
- **Explicit buttons only for creation and publication.** Creating an entity is a real event with a real button; publishing likewise. Everything between is autosaved.
- **A done-button on an autosaving editor is labeled "Done", never "Save".** "Save" promises something the button doesn't do and implies the rest wasn't saved.
- **Quiet indicator.** Idle shows nothing - autosave is the norm, not news. Saving is a small spinner (150ms delay so fast writes barely flash), saved a checkmark that fades after ~1.2s. Failure is the only state that earns words: a persistent tappable retry. Grid-stack the states so a swap never shifts layout.
- **Init fields once per entity id.** A slow round-trip that re-inits a bound field clobbers what the user typed next.
- **Debounce timer nulled after firing**, or blur re-saves the same value. Dedupe with lastSaved/lastSent guards for the blur-flush vs done-click race.
- **Delete vs archive is decided per entity** and written down; deleted things that can be restored get a restore path. Confirmations are inline two-step (tap, then confirm in place), never `confirm()`: the native dialog renders in the browser's language, not the app's.

### Optimistic updates

Kit: `toast/` (toasts store + Toast pill).

One-shot mutations (toggle, add, remove, archive, reorder) never make the user wait for the round-trip: snapshot local state, apply the change immediately, fire the write, and on failure restore the snapshot and show `toasts.error(...)`. The optimistic UI is the success feedback; only failure gets a message. Discovered on Yael's posting checklist: an awaited checkbox reads as a broken checkbox.

- **Snapshot-and-revert, not rollback logic.** Keep the previous value of exactly the state you mutate and restore it wholesale in `catch`. No inverse operations.
- **Autosaved text is not this.** Debounced field saves go through SaveTracker + SaveStatus, which carry their own inline retry; don't toast those.
- **Awaited is still right when navigation depends on the result** - creating an entity and routing to its id, deleting and leaving the page. Keep the busy flag, add a failure toast.
- **Mount `<Toast />` once at the app root**, outside the auth gate.
- **Reordering lists is drag & drop** (kit `reorder/`), not up/down arrows - arrows are miserable on a phone. Handle-only `touch-action: none` keeps the page scrollable; the drop commits optimistically.
- Toast copy follows the register rules (action nouns): "העדכון נכשל", "ההוספה נכשלה", "המחיקה נכשלה".

## Keyboard and input

### Virtual keyboard

The viewport meta `interactive-widget=resizes-content` plus the `position: fixed; inset: 0` app root handles keyboard resize declaratively (shell.md, Height handling). The layout viewport shrinks when the keyboard opens; no JS needed.

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

Kit: `router/`. Use a hash router by default. It makes the browser back button work and deep links survive app restarts from the home screen. A tiny hand-rolled one is fine - no library needed.

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

## Install prompts

Kit: `install/` (InstallBanner) plus the inline capture in `shell/index.html`.

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
- **"Today" is local, never `toISOString().slice(0, 10)`.** That's UTC; in Israel it points at yesterday between midnight and 3am, and it broke a dashboard, a posting board and upload dates at once. Use `localDateStr()` (kit `format/`).
- Anything "daily" (a message of the day) re-checks the date on `visibilitychange`: an installed app sits open across midnight.
- Admin/internal UIs use numeric dd/mm/yyyy - compact and scannable.
- User-facing apps use Hebrew prose dates via `Intl.DateTimeFormat('he-IL')` - warmer and more natural.
- Duration is always `m:ss`: no leading zero on minutes, zero-padded seconds.
- Use `font-variant-numeric: tabular-nums` on any time or date display to prevent layout jitter.
- For relative times, use a ladder: just now / Xm / Xh / yesterday / Hebrew date. `Intl.RelativeTimeFormat('he', { numeric: 'auto' })` handles the Hebrew naturally.

### Shared helpers

Extract date/time formatting into a shared module per project so every component renders consistently. Don't inline ad-hoc formatting. Kit: `format/` (`localDateStr`, `formatDate` dd/mm/yyyy, `formatTime` m:ss).

## Timing constants

These are the house timing signature. Use them consistently.

### General

| Constant | Value | Purpose |
|----------|-------|---------|
| Save status auto-clear | 3000ms | Settings save confirmations |
| Test status auto-clear | 5000ms | Test notification confirmations |
| Error auto-clear | 8000ms | Error messages (guard: check message hasn't changed) |
| Update check interval | 1h | Plus on launch and every return to foreground |
| Quiet-launch window | 10s | An update landing this soon after launch, before any tap, reloads silently |
| Autosave debounce | 800ms | Autosaved fields (SaveTracker) |
| Draft save debounce | 300ms | localStorage draft persistence (chat composer, journal) |
| Position save interval | 5s | Audio playback position persistence |
| Upload concurrency | 3 | Files in flight at once |

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
- localStorage key discipline: use a versioned prefix per app (`appname.key.v1`), not bare keys like `pin` or `darkMode`. The kit's own defaults (`app.progress.v1`, `app.dark.v1`) are seams: rename them per app.

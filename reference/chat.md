# Chat and realtime apps

Kit: `chat/` (WebSocket client with the reconnection state machine), `remote-log/`, `image-resize/`, `theme/`. Angel is the reference implementation; Glopus is the older SSE variant.

## Chat / realtime apps

This section applies to apps with a persistent server connection and streaming responses - companion chatbots, collaborative tools, anything with a WebSocket. Skip it for static content apps.

### Transport: WebSocket

Use a single WebSocket connection, not SSE. WebSocket supports bidirectional messaging (auth, ping/pong, send, stream) over one connection. Auth via `{ type: 'auth', pin }` on open; the server stores `authed` state on the connection.

### Connection state machine

Socket states: `disconnected -> connecting -> authenticating -> connected -> reconnecting`. (Per-conversation stream phases are a separate, smaller machine: `idle | connecting | streaming | reconnecting`.) Render as the 8px status dot (green = connected, amber pulse = reconnecting) plus a small banner for error states. Enforce invariants in one `transition()` function; log every transition with a `[reconnect]` tag and forward tagged logs to the server (kit `remote-log/`): that's how the mobile bugs get found.

The server side: an auth timeout on a fresh socket (10s) so unauthenticated sockets don't linger; on `auth:ok`, send snapshots of any active streams so a returning client catches up.

### Reconnection

This is what separates "works" from "feels native."

1. **`visibilitychange` is the primary reconnect trigger on mobile.** On becoming visible, cancel pending backoff timers and reconnect immediately. Mobile Chrome throttles background timers to 60s+; without this, every app-switch-back shows a dead connection for a minute.

2. **`online`/`offline` events for instant honesty.** `offline` force-closes the socket and shows reconnecting immediately. `online` resets backoff to 1s and reconnects now. Fastest possible signal, faster than any heartbeat.

3. **Heartbeat with a tight deadline.** Ping every 10s, pong deadline 5s. A silent connection drop surfaces in 15s worst case.

4. **The server keeps streams alive regardless of connection state; the client catches up.** On reconnect after successful auth, the server sends active stream snapshots. Events carry a monotonic sequence number; the client drops `seq <= lastSeen`, making snapshot + live replay idempotent.

5. **Exponential backoff.** Start at 1s, double each attempt, cap at 30s. Reset to 1s on successful auth.

6. **A hard ceiling.** If reconnecting hasn't succeeded in 90s, surface an error state with a reload hint. No UI state may be permanent.

7. **Recovery never reloads the page.** Re-fetch messages in place. The user's scroll position and the text in the composer are sacred; an early version reloaded on server restart and people lost both.

8. **If you take over reconnection, disable the transport's own retry.** With SSE, close the EventSource the moment you enter `reconnecting`, or its native auto-reconnect fires spurious errors that compete with your polling. (SSE also needs the server to send `: heartbeat\n\n` every 30s: proxies and mobile browsers close silent streams.)

The liveness hierarchy: the browser's `offline`/`online` events beat any heartbeat; the heartbeat beats backoff.

### Send path integrity

**Optimistic insert.** Insert the user's message into the UI immediately with a temporary ID (descending negative integers or `tmp-${uuid}`). Reconcile against the server's real ID so the keyed `{#each}` doesn't remount the DOM element.

**Never eat a message.** On total send failure: restore the text to the textarea and re-save the draft. The user must never lose what they typed. Before retrying a send, re-fetch server messages first - if the server already has it, sync instead of double-sending.

**Double-tap protection.** A synchronous `sending` lock flipped before the first await prevents duplicate sends from fast taps, and `ensureConversation()` memoizes the in-flight create promise. Without both, two conversations can be created from one first message.

**Stream reset.** The server may retract uncommitted output (`stream:reset` with the authoritative parts back to the last committed boundary); the client replaces, never appends. On `done`, drop tools that were announced but never resulted.

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

**Image upload:** Resize on the client before uploading (kit `image-resize/`): max dimension 1568px, JPEG 0.85, iterate down to 0.3 until under 4MB. Upload immediately on selection with send blocked while uploading.

**Paste handling:** Image pastes from clipboard become attachments. Long text pastes become a collapsible chip rather than flooding the textarea; short pastes go inline. Threshold: 600 chars or 8 lines (Angel, the newer choice; Glopus used 200/3). Very long pastes (>6000 chars) become an out-of-context document referenced by id.

Wire format: wrap attached content in pseudo-XML tags (`<attached-file name="...">...</attached-file>`, `<pasted-content>...</pasted-content>`), stripped back out for display.

### Updates in a chat app

Same flow as every app (updates.md): `updates.init({ canReload: () => !anyStreaming })`. No build-hash polling; the service worker is the signal.

# Chat and realtime apps

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

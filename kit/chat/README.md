# chat

The WebSocket connection layer for chat/realtime apps. Spec: `reference/chat.md`.

`lib/ws-client.ts` → `shared/lib/`. The app builds a reducer over its own message types and gives `WsClient` five small predicates/builders (auth message, isAuthOk/isAuthFail/isPong, ping). Baked in: state machine, auth-then-connected, ping 10s / pong 5s, backoff 1→30s, offline/online/visibility signals, 90s stall callback, `[ws]` transition logs.

The app layer owns (from Angel's reducer, `~/source/temp/angel/src/client/streamManager.ts`):
- seq dedupe: `if (msg.seq <= state.streamSeq) return` per conversation, so snapshot + live replay is idempotent
- optimistic user message with `id = nextMsgKey--` (negative), replaced in place when `msg:user` confirms, so the keyed each doesn't remount
- `pendingSend` kept until confirmed and re-sent on every `auth:ok`
- on `auth:ok`, apply `activeStreams` snapshots and reload conversations that were streaming but aren't in the snapshot
- `stream:reset` replaces parts; `done` drops tools without results
- errors clear after 8s (guard: only if unchanged)

Verify: kill the server mid-stream, background the tab 2 minutes, toggle airplane mode: dot goes amber within ~15s and recovers within 1s of `online`; a message sent while offline arrives once after reconnect; 90s of no server → stall callback fires once.

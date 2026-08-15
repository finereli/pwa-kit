# remote-log

Forward `[tagged]` console lines to the server in 2s batches so phone-only bugs can be read server-side. `lib/remote-log.ts` → `shared/lib/`; a `POST /api/client-log` sink server-side. Verify: `console.log('[test] hi')` on a phone shows in server logs within 2s.

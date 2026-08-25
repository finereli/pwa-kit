# pin-auth

PIN keypad auth for single-user apps: a 4-digit code typed on a phone-style
keypad (or a desktop keyboard), checked against a Pages secret, then sent as
the bearer token on every request. The simple end of the auth spectrum -
`auth/` (Google + sessions) is for multi-user apps; this is for an app with
exactly one user and one secret. Origin: Accountant (accountant.finereli.com).

## Files

| Kit file | Goes to |
|---|---|
| `lib/pin-auth.example.ts` | `src/lib/auth.svelte.ts` (the one instance; set the storage key) |
| `ui/PinLogin.svelte` | `src/views/PinLogin.svelte` (brand the head; fix the import if paths differ) |
| `functions/api/_middleware.ts` | `functions/api/` |
| `functions/api/auth/check.ts` | `functions/api/auth/` |

Pair with `api/` - the store satisfies its ApiAuth contract (`token` +
`handleUnauthorized`), so `makeApi(auth)` works unchanged and every 401
funnels back to the keypad.

Set the PIN: `echo "1234" | wrangler pages secret put PIN --project-name <app>`
and `PIN=1234` in `.dev.vars` for local dev.

## Decisions baked in

- **The PIN is the credential, not a session.** No server state, nothing to
  expire or prune. Rotating the Pages secret signs the user out everywhere.
- Stored raw in localStorage; optimistic boot (a stored PIN shows the app
  immediately, the first API call re-validates, a 401 drops to the keypad).
- Auto-submit at LENGTH digits - no confirm button. A wrong PIN shakes the
  dot row, flashes it `--danger`, and clears after 450ms.
- Desktop keyboard works without focus management: a `svelte:window` keydown
  listener takes digit rows, numpad, and Backspace; modifier chords are left
  alone so browser shortcuts keep working.
- The middleware also accepts `x-pin` so a local CLI can call the same API
  without impersonating a browser.
- `/api/auth/check` is just "did the middleware let me through" - the check
  endpoint has no logic of its own.

## Seams

`KEY` in the store (per-app localStorage prefix), `LENGTH` in PinLogin (match
the secret), the brand block in PinLogin (mark + app name), the import path
of the auth store if the app keeps views elsewhere.

## Verify

1. `PIN=1234` in `.dev.vars`, run dev, open the app: keypad shows, wrong PIN
   shakes and clears, right PIN lands on the app.
2. Type the PIN on a desktop keyboard (top row and numpad) - dots fill;
   Backspace deletes.
3. Reload: app opens without the keypad (stored PIN).
4. Change `PIN` in `.dev.vars`, restart dev, trigger any API call: 401 drops
   back to the keypad.

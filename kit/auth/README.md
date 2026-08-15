# auth

Google sign-in with server-issued 90-day sessions, D1-backed, plus the double-locked dev bypass. Spec: `reference/behavior.md` → Auth, `reference/deployment.md` → Preview isolation.

## Files

| Kit file | Goes to |
|---|---|
| `lib/google-auth.svelte.ts` | `shared/lib/` |
| `lib/auth.example.ts` | `src/lib/auth.svelte.ts` (the one instance; fill in clientId, storageKey, devHostSuffix) |
| `ui/Login.svelte` | `shared/ui/` |
| `functions/google-token.ts`, `functions/sessions.ts` | `shared/functions/` |
| `functions/api/_config.ts`, `auth.ts`, `_middleware.ts` | `functions/api/` of each app (fix the relative import to shared/) |
| `db/auth.sql` | append to the app's `schema.sql`; `wrangler d1 execute <db> --file` |

Pair with `api/` (the fetch wrapper that funnels 401s) and `infra/` (`.dev.vars`, `[env.preview.vars]`).

## Decisions baked in

- Popup flow, never redirect (deep links survive). One Tap → popup fallback polling `popup.location` every 200ms across the cross-origin phase.
- The credential is `data.session || response.credential`: signs in even if the server is unreachable; the first server-backed call 401s and re-prompts.
- `handleUnauthorized()` clears and re-prompts; `onChange` listeners reset per-user stores; `disableAutoSelect()` on sign-out.
- Server: certs cached 1h module-level; audience checked against `CLIENT_ID`; sessions `sess_<64 hex>`, expired rows pruned on create.
- Middleware order: `/api/auth` passthrough → dev bypass → session → raw id_token. Sets `context.data.user`; handlers never trust client ids.
- Dev bypass requires host (localhost / *.pages.dev) AND `DEV_AUTH === 'allow'`. Never a hostname check alone.
- Users table carries `is_admin`; `REQUIRE_ADMIN` in `_config.ts` gates admin apps with 403.

## Seams

`clientId` (client + `_config.ts`, keep them equal), `storageKey`, `devHostSuffix`, `devUser` (defaults to Eli's; must match server `DEFAULT_DEV_USER`), `REQUIRE_ADMIN`, `PUBLIC_PATHS` (unauthenticated API prefixes), Login props (title, subtitle, icon, buttonLabel), Login background (`--accent-deep`).

## Verify

Production domain: sign in; delete the session row in D1 → next API call 401s → re-prompt is seamless. localhost with `.dev.vars DEV_AUTH=allow` → auto-signed as dev user; remove the var → 401 (bypass off). Preview URL → dev user, and writes land in the preview DB only. Sign out on a shared device, sign in as someone else → per-user stores are empty until refetched.

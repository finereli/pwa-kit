# login

Sign in with Google through login.finereli.com, the one shared sign-in for every finereli app. **This is the default for a new app.** No Google Cloud project, no OAuth client, no secret, no Console visit: an app on `*.finereli.com` just works. Spec: `reference/behavior.md` → Auth. The service itself lives in finereli/finereli-login.

## Files

| Kit file | Goes to |
|---|---|
| `lib/finereli-login.ts` | `shared/lib/` |
| `lib/account.example.svelte.ts` | `src/lib/account.svelte.ts` (the one instance; set `storageKey`) |
| `functions/verify-login.ts` | next to the app's API code (`worker/`, or `shared/functions/` for Pages) |

Pair with `api/`: `makeApi(login)` gives the bearer header and the 401 funnel. No Login screen is included: where sign-in lives (a gate, a drawer row) is the app's call.

## How it works

1. `login.signIn()` opens `login.finereli.com/start?return=<app origin>/` in a popup.
2. That service signs the user in with Google (or skips Google when this browser already signed in there, so the second app is one tap) and sends the popup back to the app's origin with `?finereli_code=`.
3. The opener polls `popup.location` every 200ms; it throws while cross-origin and is readable once the popup is home. Take the code, close the popup, `POST /exchange` → `{ token, user }`.
4. The token is an ES256 JWT, 90 days, `aud` = the app's origin. The Worker checks it with `verifyLogin(request, { audience })`, which fetches the public key from `/jwks.json` (cached an hour).

## Decisions baked in

- Popup first, never losing the page: deep links (hash routes) survive. A blocked popup falls back to a full redirect back to the current URL; `handleRedirect()` at startup finishes it.
- The code rides in the query, not the fragment, because hash routers own the fragment. It is one-use and dies in 60s; `handleRedirect()` strips it with `replaceState`.
- Inside the popup (`window.name === 'finereli-login'` with an opener) the app leaves the code for the opener. With no opener (some iOS standalone cases) the popup window finishes the sign-in itself.
- Tokens are scoped by audience: the service mints one per app origin, and an app accepts only its own, so a token from one app is useless in every other.
- `handleRedirect()` also refreshes a token older than a day (`POST /refresh`), so sessions slide while the app is used. Offline, the old token is kept.
- `signOut()` forgets the token here and makes the next sign-in show Google's account chooser. It does not sign the browser out of other apps.
- `user.sub` is the Google account id. It is the same id any Google client sees, so an app moving here from its own client (kit `auth/`) keeps its users. Key app data on it, never on email.
- The app has no keys. The only secrets are the service's (Google client secret, signing key).

## Seams

`storageKey` (per app), `audience` in the Worker (production origin plus `http://localhost:5173` for dev), `loginOrigin` (defaults to `https://login.finereli.com`), `issuer` in `verifyLogin` (same default; only a test stand-in changes it).

A new domain outside `*.finereli.com` (an app on yaelfiner.com, say) is one entry in `ALLOWED_ORIGINS` in finereli-login's `wrangler.jsonc`, then deploy it. Previews on `*.pages.dev` are not allowed by default, because any allowed origin can learn who a signed-in visitor is; add the app's own preview suffix (`https://*.myapp.pages.dev`) if it needs one.

## When not to use it

- The app needs Google scopes beyond identity (Drive, Calendar, Gmail): it needs its own OAuth client and consent screen, kit `auth/` plus the `google-oauth-setup` skill.
- The app belongs to someone else (a client's app), or must show its own brand on Google's screen instead of "finereli.com".

## Verify

Local: `wrangler dev` (or vite with the API proxied) on localhost:5173, sign in, see the popup close and the user appear; the API answers 200 with the bearer and 401 without. Production: sign in on one app, then a second app signs in without seeing Google. Sign out, sign in again → Google's account chooser. Delete the token from localStorage → the next API call 401s and the UI offers sign-in. 100 Shots (finereli/100habits) is the reference app, including a Playwright two-device run with a stand-in login service (its worker takes `LOGIN_ISSUER`).

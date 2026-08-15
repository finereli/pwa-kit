# api

The one fetch wrapper: bearer token, JSON bodies, 401 → `auth.handleUnauthorized()`. Spec: `reference/behavior.md` → Auth.

`lib/api.ts` → `shared/lib/`; app does `export const { api, apiJson } = makeApi(auth)` in `src/lib/api.ts`. Blob/FormData/streams pass through untouched. Verify: expire a session → next call re-prompts instead of leaving stale data.

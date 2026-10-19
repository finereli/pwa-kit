# mcp

Let the user's own agents (Claude, ChatGPT, Claude Code, Glopus) use an app, over MCP, with the standard OAuth 2.1 flow those
clients expect: they discover the server, register themselves, and send the user to a sign-in page to approve. No keys to paste.
The user approves by signing in with Google through `login.finereli.com`, so this item needs the `login` pieces
(`finereli-login`: verify a token, redirect to `/start`).

Origin: the Accountant (single owner, read-only tools) and Yara Reads (multi-account, tools that write), both after notime's
`worker/mcp-auth.ts`. Almost every app we build should have this; copy it in early.

## Files

| Kit file | Goes to |
|---|---|
| `db/mcp.sql` | a D1 migration (`schema/migrations/…-mcp.sql`) |
| `functions/mcp-auth.ts` | `shared/functions/` - the OAuth core, configured once with `makeMcpAuth({...})` |
| `functions/mcp-server.ts` | `shared/functions/` - the `/mcp` JSON-RPC endpoint; you supply the tools |
| `ui/AgentsPanel.svelte` | `shared/ui/` - Settings > Agents: the address to give an agent, approved agents, disconnect |
| `scripts/dev-login.mjs` | `scripts/` - a stand-in for login.finereli.com for local testing |
| `scripts/mcp-flow-test.mjs` | `scripts/` - walks the whole flow against a dev server |

Not in the kit (write them per app): the tools, the consent sentence, which sign-ins are accepted, and the two settings endpoints.

## Wiring (Pages Functions)

```ts
// functions/_mcp-config.ts
export const mcpAuth = makeMcpAuth({
  appName: 'Accountant',
  consent: 'read your balances, transactions and forecast. It cannot change anything.',
  identify: async (token) => {
    const claims = await verifyLoginToken(token, { audience: ['https://accountant.finereli.com', 'http://localhost:8788'] })
    return claims?.email === OWNER_EMAIL ? 'owner' : null   // multi-account: return claims.sub for anyone
  },
})
// functions/.well-known/[[path]].ts, functions/oauth/[[path]].ts
export const onRequest = async ({ request, env, next }) => (await mcpAuth.route(request, env.DB, new URL(request.url))) ?? next()
// functions/mcp.ts
const mcp = makeMcpEndpoint({ auth: mcpAuth, name: 'accountant', instructions: '…', tools, context: (sub) => ({ sub }) })
export const onRequest = ({ request, env }) => mcp(request, env.DB)
```

A Worker (Yara Reads) does the same in its `fetch`: `const r = await mcpAuth.route(request, db, url); if (r) return r;` and
`if (url.pathname === '/mcp') return mcp(request, db)`, and adds `"/mcp", "/.well-known/*", "/oauth/*"` to
`assets.run_worker_first` in wrangler so static assets don't swallow them.

Settings endpoints (behind the app's own auth): `GET /api/agents` -> `mcpAuth.listClients(db, sub)`; `DELETE /api/agents/:id` ->
`mcpAuth.revoke(db, id, sub)`. Render `AgentsPanel` with `address = location.origin + '/mcp'`; revoke optimistically, and re-fetch
the list when the panel opens (an agent may have been connected since).

## Decisions baked in

- **Approve = sign in.** Nothing to paste, nothing long-lived in a URL. The agent only ever holds tokens it was issued: access 24 h,
  refresh 180 days, rotated on every use, all stored as sha256 hashes. Disconnecting deletes every token of that agent for the account.
- **The account is on the token** (`sub`). Single-owner apps return a constant from `identify` (and refuse anyone but the owner);
  multi-account apps return the Google `sub`, so each approver's agent works in their own account.
- **Public client + PKCE (S256 only)**, no secrets. Dynamic client registration accepts only https (or localhost) redirects, and
  `/oauth/authorize` refuses a redirect the client didn't register - it says so on the page rather than redirecting.
- **Streamable HTTP with plain JSON replies**: no SSE, no sessions, so it runs in a Worker or a Pages Function with nothing else.
- **Tools run as the account, through the app's own queries.** Reuse what the screens use so an agent sees what the user sees.

## Seams

`appName`, `consent` (the one sentence the user reads), `identify`, `scope` (a label only), the consent page's look (`page`/`button`
in mcp-auth.ts), the tools, the `instructions`, and `context`.

## Gotchas

- **`identify` must verify against an explicit audience list** (prod origin + local dev origin), not the request's `url.origin`:
  under `wrangler dev` with a custom-domain route the request URL can report the production hostname over http, so a locally
  minted token fails the check. (Yara Reads passes its `AUDIENCE`.)
- **Preflight and 401s matter.** Clients start by POSTing `/mcp` with no token and reading `WWW-Authenticate: Bearer
  resource_metadata=…`; without it they never begin the OAuth dance. `bearerSub` + `unauthorized` do this; keep CORS open (`*` is fine,
  the credential is the bearer header).
- **Tell agents the rules in the tools**, not in a docs page: a `guide` tool plus `instructions`, and refusals (`fail(...)`) that say
  exactly what to change. Yara Reads' `src/agent-guide.txt` is the model.
- **Writes need an owner column.** If agents can add content, mark it with the account (`owner`) and check the public/anonymous
  queries exclude it.
- **An agent with a browser should be able to see its work**: a one-hour read-only preview link (`preview_url` in Yara Reads).

## Verify

1. `echo 'LOGIN_ORIGIN=http://localhost:8788' >> .dev.vars` (and make the app read it for the issuer and `/exchange`), run
   `node scripts/dev-login.mjs you@example.com sub-1 http://localhost:8787` and the dev server.
2. `node scripts/mcp-flow-test.mjs http://localhost:8787` - every line PASS, and the tool list you expect.
3. Then once for real: in Claude (Settings > Connectors > custom connector) or `claude mcp add --transport http <name> <url>/mcp` then
   `/mcp`, paste the address, approve with Google, call a tool. The approved agent appears in Settings > Agents; Disconnect, and the next
   call fails with 401.

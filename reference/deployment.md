# Deployment

## Deployment

### Worker-backed apps

Single Cloudflare Worker with `wrangler.jsonc`:

```json
{
  "assets": {
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/ws"]
  }
}
```

Those two lines make a routerless SPA and a WebSocket upgrade coexist with the static asset layer. Add D1 bindings, a named Durable Object (`idFromName('appname')` for single-user), and a custom domain route.

### Pages apps

`pages_build_output_dir` in wrangler config. Server functions in `functions/api/` with `onRequestGet/Post`. D1 binding for data, R2 (over HTTPS from a custom domain, not a binding) for large media. Every branch gets a preview deploy, which the auth dev-bypass hostname check depends on.

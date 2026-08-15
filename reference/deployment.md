# Deployment

Kit: `infra/` (GitHub Actions workflow, wrangler.toml with `[env.preview]`, `.dev.vars`, `setup-preview.sh`).

## Pages apps (the default)

Cloudflare Pages project per app, `pages_build_output_dir = "dist"`. Server functions in `functions/api/` with `onRequestGet/Post` and a `_middleware.js` that authenticates everything under `/api/` (kit `auth/`). D1 binding for data. R2 for large media, served over HTTPS from a custom domain (`media.example.com`), not through a binding: Pages caps bundled files at 25MB and media elements want range requests straight from the edge.

Two apps in one repo (a public app and its admin) each get their own Pages project and workflow; both import `shared/` by relative path (`$shared` alias in vite; the Pages Functions bundler follows relative imports too, so nothing is published). Each workflow's `paths` filter includes `shared/**` so a shared change deploys both.

## CI

GitHub Actions on push to any branch. `actions/checkout` with `fetch-depth: 0` (the build number is the commit count). `wrangler pages deploy dist --project-name X --branch ${{ github.ref_name }}`: `main` is production, every other branch is a preview deployment.

## Preview isolation

Preview deployments bind whatever `wrangler.toml` says. If that's production D1/R2, then together with the dev-token login bypass every preview URL is a door into real data (this happened). So: `[env.preview]` in wrangler.toml binds a preview D1 (and R2), and only that env carries `DEV_AUTH = "allow"`. `scripts/setup-preview.sh` creates them once, applies the schema, copies content tables (never users/sessions), and writes the bindings. It fails loudly on the free plan's 10-database cap instead of masking it.

Locally, `.dev.vars` (gitignored) sets `DEV_AUTH=allow` for `wrangler pages dev`.

## Data conventions that came from pain

- **Slugs are frozen once published.** They're in links already shared to WhatsApp groups. The API rejects renames of published items; drafts can be renamed.
- **Storage keys are UUIDs, separate from slugs.** `media_key` names the R2 objects (raw and encoded); the slug is for URLs. Hebrew filenames made bad slugs and an LLM rename after transcription would otherwise move files.
- **R2 prefix listing includes the trailing dot** (`${mediaKey}.`), or deleting item `abc` also deletes `abc2`.
- **Public read endpoints are CDN-cached** (`s-maxage=300, stale-while-revalidate=3600`); content is live within minutes of a DB change with no deploy.
- **`wrangler d1 execute` is the escape hatch** for bulk edits; the admin is the front door.

## Worker-backed apps (chat)

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

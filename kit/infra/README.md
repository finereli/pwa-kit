# infra

Deploy plumbing: GitHub Actions workflow, `wrangler.toml` with `[env.preview]`, `.dev.vars`, and the preview-isolation script. Spec: `reference/deployment.md`.

| Kit file | Goes to |
|---|---|
| `.github/workflows/deploy.yml` | repo root (one per app; edit paths, working-directory, project name) |
| `wrangler.toml` | app root (fill ids) |
| `.dev.vars` | app root, gitignored |
| `scripts/setup-preview.sh` | repo `scripts/` (edit the seams block; run once, commit the wrangler.toml it writes) |

Baked in: `fetch-depth: 0` (build number); every branch deploys, `--branch` decides prod vs preview; `DEV_AUTH` only under `[env.preview.vars]` and `.dev.vars`; previews get their own D1/R2, content tables copied, never users/sessions; the script fails loudly on the free-plan D1 cap.

Verify: push a branch → preview URL signs in as the dev user and writes go to the preview DB; production URL has no bypass.

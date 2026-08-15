# kit

Copyable, already-debugged code for the PWA family. Each directory is one item: files plus a `README.md` (what, where it goes, decisions baked in, seams, how to verify). `MANIFEST.json` records versions and content hashes; every file carries a `pwa-kit: <item>/<file> v<n>` header. Tooling in `../scripts/`:

- `kit.py list | status <project> [--all] | bump <item> --note "…" | check`
- `typecheck/run.sh` lays the whole kit out as one Svelte+TS project and runs `svelte-check` + `vite build`. Run it after any kit edit.

Language: TypeScript everywhere (Svelte 5 runes files as `.svelte.ts`, components with `<script lang="ts">`). Apps run `svelte-check` as part of `npm run build`. Imports between kit files are extensionless (`'../lib/updates.svelte'`).

Layout convention in a project: `shared/{lib,ui,functions,build,css}/` mirrors the items' subdirectories; `functions/api/`, `src/`, `public/` and root config files go where their table says. In a repo with two apps (public + admin), `shared/` is a sibling of both and each app aliases it as `$shared`.

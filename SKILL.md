---
name: pwa
description: Build mobile-first PWAs that feel native, from a spec (reference docs on shell, visual style, behavior, updates, chat, media) plus a kit of copyable, already-debugged code (service worker update flow, Google auth + sessions, autosave, app shell, icons, router). Load before building a new mobile app, before touching PWA plumbing in an existing one, and for "update the app to the latest pwa skill" or "promote this to the kit".
---

# PWA skill

Mobile-first PWAs that feel native, look warm, and share one technical foundation. Codified from Eli's apps: Yael's meditations app and admin (app/admin.yaelfiner.com), Angel and Glopus (companion chatbots), Hayde. Follow it unless the brief explicitly calls for something different.

The skill has two halves, and the split matters:

- **`reference/`** is the spec: what the AI must *understand* to make new decisions. Principles, constants, state machines in prose, checklists.
- **`kit/`** is copyable code: things that must be *right* and were expensive to get right. Each item is a directory of concrete files plus a README with the non-obvious decisions, the seams a new app is expected to touch, and how to verify it works. Kit files are vendored into a project (copied, not imported from a package) and carry a `pwa-kit: <item>/<file> v<n>` header so `scripts/kit.py` can tell later what drifted.

Why concrete code rather than a generic component library: pre-AI, you made components generic so you'd never have to touch them, because editing was expensive. Now editing is nearly free and *correctness* is what's expensive (a service-worker state machine, an iOS keyboard quirk, an autosave race). So the kit stores correctness, not flexibility. Small, readable, commented at the decision points, adapted in place at copy time. Rule of thumb for what belongs in the kit: if it took more than one session to get right, or was fixed after a real user hit it, it's kit.

Two sharing levels: **within a repo**, apps import from one `shared/` (yaelfiner's `app/` and `admin/` do this). **Across repos**, copy from the kit. The kit is the origin of every `shared/`.

## Stack

Svelte 5 + Vite + TypeScript. Cloudflare Pages + Pages Functions + D1 + R2 for apps with a backend, or a single Worker (Durable Object) for realtime chat apps. CSS custom properties for theming, never a component library. Inline SVG icons from Material Symbols paths, never an icon font. Hash router, hand-rolled. Google sign-in with server sessions for multi-user apps, PIN for single-user.

## Where to read what

Read `reference/` files on demand, not all at once. Each is self-contained.

| Working on | Read |
|---|---|
| Any new app, or the app shell (index.html, layout, drawer, safe areas, scroll, RTL) | `reference/shell.md` |
| Colors, typography, components, animation, icons, prose | `reference/visual.md` |
| Boot sequence, auth, settings, keyboard, navigation, install prompts, dates, timing constants, autosave | `reference/behavior.md` |
| Service worker, caching, versions, the update/reload flow | `reference/updates.md` |
| A chat or realtime app (WebSocket, reconnection, send path, streaming) | `reference/chat.md` |
| Audio or video playback | `reference/media.md` |
| Push notifications | `reference/push.md` |
| Cloudflare deploy, CI, preview isolation, dev auth bypass | `reference/deployment.md` |
| Before shipping | `reference/checklist.md` |
| Hebrew UI copy | `reference/hebrew.md` |

## The kit

`python3 scripts/kit.py list` prints the current items. Each `kit/<item>/README.md` says what it is, the decisions baked in, the seams, and how to verify.

| Item | What | Origin |
|---|---|---|
| `updates` | SW registration + update flow, reload icon, `reset.html`, vite build helper (`__BUILD__`, workbox options) | Yael's app/admin, after the stuck-phone saga |
| `auth` | Google sign-in + 90-day D1 sessions, token verification, `/api/auth`, middleware, schema, Login, double-locked dev bypass | Yael's app/admin, after the journal leak + preview review |
| `pin-auth` | PIN keypad login for single-user apps: keypad + desktop keyboard entry, PIN-as-credential store, Pages-secret middleware, `/api/auth/check` | Accountant |
| `mcp` | MCP server for the user's own agents: OAuth 2.1 approved with Google, JSON-RPC endpoint, Agents settings panel, local flow test (see the `mcp-server` skill) | Accountant, Yara Reads |
| `api` | fetch wrapper: bearer, JSON, 401 funnel | Yael's admin |
| `save` | SaveTracker, SaveStatus, AutoTextarea (autosave-first) | Yael's admin |
| `toast` | error toasts + optimistic-update revert pattern | Yael's admin |
| `reorder` | touch-first drag-to-reorder (pointer events, edge autoscroll) | Yael's admin |
| `shell` | base.css tokens/reset, TopBar, Drawer, AccountMenu, Btn, index.html, App/main templates, vite/ts/svelte/package config | Yael's app/admin, Angel (balanced sidebar, account menu) |
| `settings` | SettingsPage frame, SettingsRow, settings.css: flat first, an index of sub-pages when it grows | Angel |
| `router` | hash router with the history rules | Yael's app |
| `format` | localDateStr, formatDate, formatTime | Yael's shared |
| `media` | Player engine (audio owns, muted video follows), progress persistence | Yael's app |
| `upload` | XHR upload with progress + pipeline queue | Yael's admin |
| `install` | InstallBanner slide-in + globals d.ts | Yael's app |
| `icons` | Icon.svelte + Material Symbols extraction | Yael's app |
| `chat` | WsClient: reconnection state machine, heartbeat, backoff, browser signals | Angel |
| `remote-log` | tagged console → server | Glopus |
| `image-resize` | client-side resize before upload | Glopus |
| `theme` | v1: dark mode before first paint, accent-derived palette. v2 upgrade (optional): light/dark/match-device, accent picker, app icon in the accent | Glopus, Angel |
| `infra` | deploy workflow, wrangler.toml with `[env.preview]`, `.dev.vars`, setup-preview.sh | Yael's repo |

Language: TypeScript everywhere; apps run `svelte-check` in `npm run build`. `scripts/typecheck/run.sh` type-checks and builds the whole kit as one project.

## Procedures

### Build an app from the kit

1. Read `reference/shell.md`, `reference/behavior.md`, `reference/updates.md`, and the profile you need (chat / media / admin). Skim `reference/visual.md` for the token set and component shapes.
2. Copy the kit items the app needs into the project. Convention: `shared/{lib,ui,functions}/` mirrors the kit's layout so app and admin siblings in one repo can both import it; `public/reset.html` and the `index.html` head go where they go. Keep the `pwa-kit` headers exactly as they are.
3. Work the seams listed in each README: theme tokens, storage-key prefix, dev-host suffix, app name in the manifest, the vetoes for auto-reload (audio playing, upload in flight), the drawer contents.
4. Run each item's verify recipe before moving on. The updates flow in particular has to be seen working (two builds, swap under a running page) before you build on top of it.
5. Everything domain-specific goes in the app, not in `shared/`. Resist generalizing before a second app needs it.
6. When done, run the ship checklist and `scripts/kit.py status <project>` (should be all `current`).

### When kit changes reach an app

Pull, not push. A kit change does not mean every app gets updated now. An app takes the latest kit when someone is working on it anyway: before touching its shell, settings or update flow, run `status`, and take what's `upstream` while the context is loaded. The exceptions are fixes for something users are hitting (a stuck update, a data-loss race); those are worth a pass over every app that has the item.

Drift is fine. A `modified` file is an app that made a decision, not a debt. Each app's copy is its own code, and that is what makes the kit cheap to change: nothing breaks downstream when it moves. The manifest's version notes are the changelog an app reads when it does catch up.

The flow is two-way. Most kit changes start as a fix or a better idea in one app (Angel's sidebar footer, Yael's update flow). Promote it while the reasons are fresh, and the next app that updates gets it with the reasons attached.

### Update an app to the latest kit

The user says "update the app to the latest pwa skill" or similar.

0. A project that predates the kit has no headers, so `status` finds nothing. First adoption: map its files to kit items by name (`shared/lib/updates.svelte.js` ↔ `updates/lib/updates.svelte.ts`), diff by hand, and adopt item by item: replace with the kit file (header included), move app-specific bits behind the item's seams, add the alias block if the app has its own token names, convert `.js` importers to the new paths. Report the diff first; the owner decides what to adopt.
1. `python3 ~/.claude/skills/pwa/scripts/kit.py status <project> --all`. Statuses: `current` (nothing to do; `kit.py relabel <project>` rewrites the header if the version moved), `upstream` (kit moved, copy untouched: copy the new file over, keep going), `modified` (project edited it, kit didn't move: leave it, but read the diff and consider promoting), `both` (three-way merge: read the project's edits, read the kit's change and the note in `MANIFEST.json`, produce a merged file that keeps both intents), `unknown` (header points at something the manifest doesn't know: investigate), `available` (kit items the project doesn't have: mention, don't add unprompted).
2. For every file touched, run the item's verify recipe. Build both apps if the repo has two.
3. Report per file what happened and why. Never silently overwrite a `modified` or `both` file.
4. If the update changed behavior users can see (a label, the reload moment), say so; the app's owner may want to know before it deploys.

### Promote to the kit

After building or fixing something in an app that a future app would want. The skill's meta-rule: after every app build, raise whether something should be promoted or a reference doc should change. Don't update silently; talk it through so the skill doesn't over-fit to whatever was built last.

1. Decide spec or kit. A rule, principle, or constant goes in `reference/`. Code that must be right goes in `kit/`.
2. For kit: copy the file(s) into `kit/<item>/` (new item or existing), strip anything app-specific behind a seam (a constructor option, a CSS token, a callback), keep the comments at the decision points, and write or update `README.md`: what, decisions, seams, verify. Add a `verify` recipe you actually ran.
3. `scripts/typecheck/run.sh` must pass (svelte-check + vite build over the whole kit).
4. `python3 scripts/kit.py bump <item> --note "what changed"`. This rewrites headers and records hashes. Then copy the bumped files back into the source project so its headers match (`status` should show `current`).
5. `python3 scripts/kit.py check` must print `ok`.
6. Update the reference doc that describes the behavior, and the kit table in this file.

## What this style is NOT

- Not a design system with 47 components and a Figma file. An app is a handful of Svelte files plus `shared/`.
- Not Tailwind-dependent. CSS custom properties are the theming layer. Tailwind utilities are fine on top; the theme must work without them.
- Not image-heavy. Text, color, typography. Hierarchy comes from weight, size and color, not graphics.
- Not over-animated. One ambient animation per app at most; everything else is quick feedback.
- Not generic. Kit code is concrete and adapted in place. Don't add props to avoid editing.

## Evolving document

After every app build, discuss whether the skill needs updating: new patterns, constants that should change, sections that didn't hold up, code worth promoting. Raise it and talk it through.

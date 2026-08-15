# icons

Inline SVG icons from Material Symbols Rounded glyph paths, no font. Spec: `reference/visual.md` → Icons.

`ui/Icon.svelte` → `src/components/` (or `shared/ui/`), `scripts/icons.py` + `scripts/icons.sh` → `scripts/`, `"icon": "./scripts/icons.sh"` in package.json, `material-symbols` as a devDependency. `npm run icon play_arrow close` writes `src/lib/icons.ts`. Verify: an icon renders before any network request completes (throttle to offline after first load).

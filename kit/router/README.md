# router

Hand-rolled hash router. Spec: `reference/behavior.md` → Navigation.

`lib/router.svelte.ts` → `shared/lib/`. The app creates one instance with its `parse(path)` and reads `router.route`. Baked in: `replace()` for sequential navigation (no history spam), `back()` falls back to home on a cold deep link, `onChange` so the drawer closes on every navigation. Seam: `parse`, `home`.

Verify: deep link from the home screen opens the right screen; back closes the drawer; skipping through five items then back leaves the list, not the previous item.

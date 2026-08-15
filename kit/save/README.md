# save

Autosave-first editing: a tracker for in-flight writes, an always-visible status, an auto-growing textarea with debounced save. Spec: `reference/behavior.md` → Save model.

## Files

| Kit file | Goes to |
|---|---|
| `lib/save-tracker.svelte.ts` | `shared/lib/` |
| `ui/SaveStatus.svelte`, `ui/AutoTextarea.svelte` | `shared/ui/` |

Usage: one `SaveTracker` per editing surface; `tracker.run(() => apiJson(...))` for every write; `<SaveStatus {tracker} />` next to the title or badge; `tracker.reset()` when the editor switches entity.

## Decisions baked in

- Pending counter: status settles to `saved` only when the last in-flight write lands.
- `retry()` re-runs the last fn. `{#key}` + grid-stacked states: no layout shift on swap.
- AutoTextarea nulls its timer after firing (blur was re-saving the same value); blur flushes a pending save.
- Debounce 800ms (autosave), distinct from the 300ms localStorage draft debounce for composers.

## Seams

SaveStatus strings (idle/saving/saved/error), `delay`, colours via `--ok` / `--danger` / `--text-secondary`.

## Verify

Type, blur immediately → one PUT, not two. Airplane mode → red tappable retry → back online → tap → ✓. Switch to another entity → idle hint returns. Fast typing across a slow round-trip → the field keeps what you typed (init-once-per-entity in the consumer).

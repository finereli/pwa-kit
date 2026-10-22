# save

Autosave-first editing: a tracker for in-flight writes, a subtle status indicator, an auto-growing textarea with debounced save. Spec: `reference/behavior.md` → Save model.

## Files

| Kit file | Goes to |
|---|---|
| `lib/save-tracker.svelte.ts` | `shared/lib/` |
| `ui/SaveStatus.svelte`, `ui/AutoTextarea.svelte` | `shared/ui/` |

Usage: one `SaveTracker` per editing surface; `tracker.run(() => apiJson(...))` for every write; `<SaveStatus {tracker} />` next to the title or badge; `tracker.reset()` when the editor switches entity.

## Decisions baked in

- Pending counter: status settles to `saved` only when the last in-flight write lands.
- SaveStatus is quiet: idle renders nothing (autosave is the norm, not news), saving is a small spinner with a 150ms fade-in delay so quick writes barely flash, saved is a checkmark that fades after 1.2s. Failure is the only state with words - a persistent tappable retry. A permanent "changes save automatically" phrase was tried first and read as noise.
- `retry()` re-runs the last fn. `{#key}` + grid-stacked states: no layout shift on swap.
- AutoTextarea nulls its timer after firing (blur was re-saving the same value); blur flushes a pending save.
- AutoTextarea restores its scroller's scrollTop after each measure (height: auto shortens the page for an instant and the browser scrolls up, so a long text slid under the phone keyboard as you typed), and typing at the end keeps the end in view. It also re-measures when its width changes and when fonts are ready, counts its border, and keeps its own scroll at 0: a box that is ever shorter than its text scrolls inside itself while the page scrolls outside.
- Debounce 800ms (autosave), distinct from the 300ms localStorage draft debounce for composers.

## Seams

SaveStatus `errorText` (the only worded state) and its timings (150ms spinner delay, 1200ms check flash, 400ms fade), `delay`, colours via `--ok` / `--danger` / `--text-secondary`.

## Verify

Type, blur immediately → one PUT, not two. On a phone (or a 380px-tall window), type a long text at the end of a field near the bottom of a scrolling view → the line being typed stays above the keyboard. Airplane mode → red tappable retry → back online → tap → ✓. Switch to another entity → idle hint returns. Fast typing across a slow round-trip → the field keeps what you typed (init-once-per-entity in the consumer).

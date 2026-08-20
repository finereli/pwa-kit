# toast

Transient error toasts - the error channel for optimistic updates. Spec: `reference/behavior.md` → Optimistic updates.

## Files

| Kit file | Goes to |
|---|---|
| `lib/toast.svelte.ts` | `shared/lib/` |
| `ui/Toast.svelte` | `shared/ui/` |

Usage: mount `<Toast />` once at the app root (outside the auth gate, so errors surface on any screen). For every one-shot mutation (toggle, add, remove, delete): snapshot local state, apply the change, fire the write, and on failure restore the snapshot and `toasts.error('...')`. Autosaved text fields don't use this - they go through SaveTracker + SaveStatus, which carry their own inline retry.

```js
async function toggle(row) {
  const prev = rows
  rows = rows.map(r => r.id === row.id ? { ...r, done: !r.done } : r)
  try {
    await apiJson(`/api/rows/${row.id}`, { method: 'PUT', body: { done: !row.done } })
  } catch {
    rows = prev
    toasts.error('העדכון נכשל')
  }
}
```

## Decisions baked in

- Error-only API (`toasts.error`). Success needs no toast - the optimistic UI *is* the success feedback. Add other kinds only when an app actually needs them.
- A repeat of a message already on screen extends its timer instead of stacking an identical pill.
- Auto-dismiss after 4s; tap dismisses. Pills are buttons - no separate close affordance.
- Fixed above `--safe-bottom`, centered (RTL needs nothing), `z-index` above the app shell, `pointer-events: none` on the container so the empty strip never blocks taps.
- Colours from `--danger`; text messages are the app's responsibility (register rules in `reference/hebrew.md` - action nouns: "העדכון נכשל", "ההוספה נכשלה").

## Seams

The `--danger` token, auto-dismiss `ms` per call, toast copy per app.

## Verify

Stub `fetch` to reject the mutation (or kill the dev backend), perform the action: the UI must change instantly, revert within a beat, and show one pill that fades after 4s. Repeat the action twice fast - still one pill. Happy path: the action's effect appears with no round-trip wait.

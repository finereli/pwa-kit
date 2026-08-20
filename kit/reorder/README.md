# reorder

Drag-to-reorder for vertical lists, touch-first. Built on pointer events because HTML5 drag & drop does not exist on touch.

## Files

| Kit file | Goes to |
|---|---|
| `lib/drag-reorder.svelte.ts` | `shared/lib/` |

Usage (one controller per list; pair the commit with the `toast` item's optimistic pattern):

```svelte
let snapshot = null
const reorder = new DragReorder({
  onstart: () => (snapshot = items),
  onmove: (from, to) => { /* splice items[from] to `to` locally */ },
  ondrop: () => commitOrder(snapshot),        // optimistic: revert + toast on failure
  scrollEl: () => document.querySelector('main'),
})

{#each items as item, i (item.id)}
  <div class="row" use:reorder.row={i}
       class:dragging={reorder.dragIndex === i} style={reorder.styleFor(i)}>
    <button class="drag-handle" use:reorder.handle={i}>⋮⋮ grip svg</button>
    ...
  </div>
{/each}
```

Required CSS: `.drag-handle { touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }` and `.row.dragging { position: relative; z-index: 5; /* shadow */ }`.

## Decisions baked in

- **Pointer events + window listeners during the drag, never `setPointerCapture` on the handle.** Reordering the keyed each moves the row's DOM node, and moving a captured element silently releases the capture - the drag dies after the first swap. This bug shipped and was caught in testing; do not "simplify" back to capture.
- **`touch-action: none` on the handle only.** That is the entire mobile story: the handle starts a drag immediately, everywhere else the finger still scrolls the page. No long-press timers.
- **Swap on crossing a neighbor's midpoint; measure the DOM move across `tick()`** and subtract it from the offset so the row stays under the finger. This makes variable row heights and gaps work with zero configuration.
- **Edge autoscroll** via an rAF loop: near the scroll container's top/bottom edge (default 48px) scroll up to 12px/frame, compensate the offset by the scrolled amount, and re-run the swap check.
- **No FLIP animation on neighbors** - mid-animation rects would re-trigger swaps and jitter. The instant shift reads fine.
- `user-select` cleared on `document.body` during the drag; a swap loop (`while swapped`) so one fast move can cross several rows.

## Seams

`scrollEl` (defaults to the document), `edge`, `maxSpeed`, all the visuals (handle icon, dragging shadow) live in the consumer.

## Verify

Mouse: drag a row several positions down and up in one gesture - it follows the cursor, neighbors shift instantly, order commits on release, reload keeps it. Touch (or DevTools device mode): drag from the handle - the page must not scroll; drag from anywhere else on the row - the page must scroll. Drag to the container edge - it autoscrolls and keeps swapping. Fail the commit (stub fetch) - order snaps back with a toast.

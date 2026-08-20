// pwa-kit: reorder/lib/drag-reorder.svelte.ts v1
// Drag-to-reorder for vertical lists, built on pointer events so it works
// on touch (HTML5 drag & drop does not). One controller per list.
//
// Usage:
//   const reorder = new DragReorder({
//     onstart: () => (snapshot = items),          // for revert on failure
//     onmove: (from, to) => { /* move items[from] to `to` locally */ },
//     ondrop: () => { /* commit the new order (optimistic, see toast/) */ },
//     scrollEl: () => document.querySelector('main'),
//   })
//   <div class="row" use:reorder.row={i}
//        class:dragging={reorder.dragIndex === i} style={reorder.styleFor(i)}>
//     <button class="drag-handle" use:reorder.handle={i}>⋮⋮</button>
//     ...
//   </div>
//
// The handle MUST have `touch-action: none; user-select: none` - that is
// what keeps the rest of the list scrollable on touch while the handle
// starts a drag immediately. Give `.row.dragging` position: relative,
// a z-index and a shadow.
//
// Mechanics: the dragged row follows the pointer via translateY. When the
// pointer crosses the midpoint of a neighbor row, onmove() reorders the
// array; the DOM move is measured across tick() and subtracted from the
// offset so the row stays under the finger - this makes variable row
// heights and gaps work without any configuration. Near the scroll
// container's edges an rAF loop autoscrolls and re-runs the swap check.
// No FLIP animation on neighbors: mid-animation rects would re-trigger
// swaps and jitter; the instant shift reads fine.
import { tick } from 'svelte'

type Options = {
  /** Called once when a drag starts - snapshot state for revert here. */
  onstart?: () => void
  /** Move the item at `from` to `to` in the local order (synchronously). */
  onmove: (from: number, to: number) => void
  /** Drag ended - commit the current order. */
  ondrop: () => void
  /** Scroll container for edge autoscroll (default: the document). */
  scrollEl?: () => HTMLElement | null
  /** Distance from the container edge that starts autoscroll (px). */
  edge?: number
  /** Fastest autoscroll, px per frame. */
  maxSpeed?: number
}

export class DragReorder {
  dragIndex = $state<number | null>(null)
  offset = $state(0)

  #rows = new Map<HTMLElement, number>()
  #opts: Options
  #pointerY = 0
  #raf = 0
  #busy = false

  constructor(opts: Options) {
    this.#opts = opts
  }

  /** Svelte action for each row element; param is the row's index. */
  row = (node: HTMLElement, index: number) => {
    this.#rows.set(node, index)
    return {
      update: (i: number) => {
        this.#rows.set(node, i)
      },
      destroy: () => {
        this.#rows.delete(node)
      },
    }
  }

  /** Svelte action for the drag handle inside row `index`. */
  handle = (node: HTMLElement, index: number) => {
    let i = index
    // Listen on the window during a drag, NOT via setPointerCapture on the
    // handle: reordering the keyed each moves the row's DOM node, and
    // moving a captured element silently releases the capture - the drag
    // would die after the first swap.
    const down = (e: PointerEvent) => this.#start(e, i)
    node.addEventListener('pointerdown', down)
    return {
      update: (ni: number) => {
        i = ni
      },
      destroy: () => {
        node.removeEventListener('pointerdown', down)
      },
    }
  }

  #onMove = (e: PointerEvent) => this.#move(e)
  #onUp = () => this.#end()

  /** Inline style for row `index` (the dragged row's translate). */
  styleFor(index: number) {
    return this.dragIndex === index ? `transform: translateY(${this.offset}px)` : ''
  }

  #nodeAt(index: number): HTMLElement | null {
    for (const [node, i] of this.#rows) if (i === index) return node
    return null
  }

  #start(e: PointerEvent, index: number) {
    if (this.dragIndex !== null || !e.isPrimary) return
    e.preventDefault()
    this.dragIndex = index
    this.offset = 0
    this.#pointerY = e.clientY
    window.addEventListener('pointermove', this.#onMove)
    window.addEventListener('pointerup', this.#onUp)
    window.addEventListener('pointercancel', this.#onUp)
    document.body.style.userSelect = 'none'
    this.#opts.onstart?.()
    this.#raf = requestAnimationFrame(this.#autoscroll)
  }

  #move(e: PointerEvent) {
    if (this.dragIndex === null) return
    const dy = e.clientY - this.#pointerY
    this.#pointerY = e.clientY
    this.offset += dy
    this.#settle()
  }

  // Swap with a neighbor once the pointer crosses its midpoint. The DOM
  // move is measured across tick() so the dragged row stays under the
  // finger whatever the neighbor's height.
  async #settle() {
    if (this.#busy || this.dragIndex === null) return
    this.#busy = true
    try {
      let swapped = true
      while (swapped && this.dragIndex !== null) {
        swapped = false
        const node = this.#nodeAt(this.dragIndex)
        if (!node) break
        const next = this.#nodeAt(this.dragIndex + 1)
        if (next) {
          const r = next.getBoundingClientRect()
          if (this.#pointerY > r.top + r.height / 2) {
            await this.#swap(1, node)
            swapped = true
            continue
          }
        }
        const prev = this.#nodeAt(this.dragIndex - 1)
        if (prev) {
          const r = prev.getBoundingClientRect()
          if (this.#pointerY < r.top + r.height / 2) {
            await this.#swap(-1, node)
            swapped = true
          }
        }
      }
    } finally {
      this.#busy = false
    }
  }

  async #swap(dir: number, node: HTMLElement) {
    const from = this.dragIndex!
    const before = node.getBoundingClientRect().top
    this.#opts.onmove(from, from + dir)
    this.dragIndex = from + dir
    await tick()
    const after = node.getBoundingClientRect().top
    this.offset -= after - before
  }

  #autoscroll = () => {
    if (this.dragIndex === null) return
    const el = this.#opts.scrollEl?.() ?? (document.scrollingElement as HTMLElement | null)
    if (el) {
      const isDoc = el === document.scrollingElement
      const top = isDoc ? 0 : el.getBoundingClientRect().top
      const bottom = isDoc ? window.innerHeight : el.getBoundingClientRect().bottom
      const edge = this.#opts.edge ?? 48
      const maxSpeed = this.#opts.maxSpeed ?? 12
      let dy = 0
      if (this.#pointerY < top + edge) {
        dy = -Math.ceil(Math.min(1, (top + edge - this.#pointerY) / edge) * maxSpeed)
      } else if (this.#pointerY > bottom - edge) {
        dy = Math.ceil(Math.min(1, (this.#pointerY - (bottom - edge)) / edge) * maxSpeed)
      }
      if (dy) {
        const before = el.scrollTop
        el.scrollTop += dy
        const scrolled = el.scrollTop - before
        if (scrolled) {
          // The row's layout position moved with the scroll; compensate to
          // keep it under the finger, then re-check for swaps.
          this.offset += scrolled
          this.#settle()
        }
      }
    }
    this.#raf = requestAnimationFrame(this.#autoscroll)
  }

  #end() {
    if (this.dragIndex === null) return
    cancelAnimationFrame(this.#raf)
    window.removeEventListener('pointermove', this.#onMove)
    window.removeEventListener('pointerup', this.#onUp)
    window.removeEventListener('pointercancel', this.#onUp)
    document.body.style.userSelect = ''
    this.dragIndex = null
    this.offset = 0
    this.#opts.ondrop()
  }
}

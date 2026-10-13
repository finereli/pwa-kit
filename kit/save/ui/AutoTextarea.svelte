<!-- pwa-kit: save/ui/AutoTextarea.svelte v4 -->
<script lang="ts">
  // Auto-growing textarea with debounced autosave. `onsave(value)` fires
  // `delay` ms after the last keystroke and on blur. The timer is nulled
  // after it fires - otherwise blur re-saved the same value a second time.
  // Pair with SaveTracker: onsave={(v) => tracker.run(() => api(...))}.
  let {
    value = $bindable(''),
    placeholder = '',
    disabled = false,
    rows = 2,
    onsave,
    delay = 800,
    autofocus = false,
    onblur: onBlurExternal,
    ...rest
  }: {
    value?: string
    placeholder?: string
    disabled?: boolean
    rows?: number
    onsave?: (value: string) => void
    delay?: number
    autofocus?: boolean
    onblur?: (e: FocusEvent) => void
    [key: string]: unknown
  } = $props()

  let el = $state<HTMLTextAreaElement | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null

  // Measuring means height: auto for an instant, which makes the page
  // shorter; the browser answers by pulling the scroll position up, and on a
  // phone the line being typed slides under the keyboard. Put the scroll
  // position back, and when typing at the end keep the end in view.
  function scroller(node: HTMLElement): HTMLElement | null {
    for (let p = node.parentElement; p; p = p.parentElement) {
      const y = getComputedStyle(p).overflowY
      if (y === 'auto' || y === 'scroll') return p
    }
    return null
  }

  function resize() {
    if (!el) return
    const box = scroller(el)
    const top = box?.scrollTop ?? 0
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + (el.offsetHeight - el.clientHeight) + 'px'
    el.scrollTop = 0
    if (!box) return
    box.scrollTop = top
    if (document.activeElement === el && el.selectionEnd === el.value.length) {
      const below = el.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom
      if (below > 0) box.scrollTop += below + 16
    }
  }

  $effect(() => {
    value
    if (el) requestAnimationFrame(resize)
  })

  // A width change rewraps the text and the font arriving changes line
  // heights; measured only on value changes, the box stayed short and
  // scrolled inside itself (notime: a restored draft hid 1000px of text).
  $effect(() => {
    if (!el) return
    const node = el
    let width = node.clientWidth
    const watch = new ResizeObserver(() => {
      if (node.clientWidth === width) return
      width = node.clientWidth
      resize()
    })
    watch.observe(node)
    document.fonts?.ready.then(resize).catch(() => {})
    return () => watch.disconnect()
  })

  $effect(() => {
    if (autofocus && el) el.focus()
  })

  function oninput(e: Event) {
    value = (e.target as HTMLTextAreaElement).value
    resize()
    if (onsave) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        onsave(value)
      }, delay)
    }
  }

  function onblur(e: FocusEvent) {
    if (onsave && timer) {
      clearTimeout(timer)
      onsave(value)
      timer = null
    }
    onBlurExternal?.(e)
  }
</script>

<textarea bind:this={el} {value} {placeholder} {disabled} {rows} {oninput} {onblur} {...rest}></textarea>

<style>
  textarea {
    width: 100%;
    font: inherit;
    color: var(--text-primary);
    background: var(--bg-raised, #fff);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 12px;
    line-height: 1.6;
    font-size: 0.9rem;
    resize: none;
    overflow: hidden;
    outline: none;
    transition: border-color 0.15s;
  }
  textarea:focus { border-color: var(--accent); }
  textarea:disabled { background: var(--bg-hover); color: var(--text-secondary); }
</style>

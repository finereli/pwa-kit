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

  function resize() {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  $effect(() => {
    value
    if (el) requestAnimationFrame(resize)
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

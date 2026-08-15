<script lang="ts">
  import type { Snippet } from 'svelte'
  // Slide-in navigation drawer that becomes a permanent sidebar on desktop
  // (>= 768px, matched by the .shell margin in App.svelte). Slides from the
  // start edge in either direction. Escape closes it; the host closes it on
  // any navigation (router.onChange) so the back button works too.
  //
  // Props: open, onclose, entries [{ label, hash, current: bool }],
  // brand snippet (logo + name), footer snippet (user row, sign-out, build
  // line with ResetButton). Seams: closeLabel, width.
  export interface DrawerEntry { label: string; hash: string; current?: boolean }
  let { open = false, onclose, entries = [], brand, footer, closeLabel = 'Close menu' }: {
    open?: boolean; onclose?: () => void; entries?: DrawerEntry[]; brand?: Snippet; footer?: Snippet; closeLabel?: string
  } = $props()

  function go(hash: string) {
    location.hash = hash
    onclose?.()
  }
</script>

<svelte:window onkeydown={(e) => open && e.key === 'Escape' && onclose?.()} />

<button class="scrim" class:open aria-label={closeLabel} tabindex={open ? 0 : -1} onclick={() => onclose?.()}></button>

<nav class="drawer" class:open aria-hidden={!open}>
  {#if brand}
    <div class="brand">{@render brand()}</div>
  {/if}

  <ul>
    {#each entries as e}
      <li>
        <button class:current={e.current} onclick={() => go(e.hash)} tabindex={open ? 0 : -1}>
          {e.label}
        </button>
      </li>
    {/each}
  </ul>

  {#if footer}
    <div class="footer">{@render footer()}</div>
  {/if}
</nav>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: block;
    width: 100%;
    background: rgba(0, 0, 0, 0.45);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .scrim.open { opacity: 1; pointer-events: auto; }

  .drawer {
    position: fixed;
    z-index: 41;
    inset-block: 0;
    inset-inline-start: 0;
    width: min(78vw, 300px);
    background: var(--bg-surface);
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    padding: calc(var(--safe-top) + 22px) 0 calc(var(--safe-bottom) + 22px);
    /* Hidden off the start edge. transform isn't direction-aware, so branch
       on the document direction. */
    transform: translateX(-100%);
    transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  }
  :global([dir='rtl']) .drawer { transform: translateX(100%); }
  .drawer.open, :global([dir='rtl']) .drawer.open { transform: translateX(0); }

  @media (min-width: 768px) {
    .scrim { display: none; }
    .drawer, :global([dir='rtl']) .drawer {
      transform: translateX(0);
      box-shadow: none;
      border-inline-end: 1px solid var(--border);
    }
  }

  .brand {
    padding: 0 22px 20px;
    border-bottom: 1px solid var(--border);
  }

  ul { list-style: none; padding: 14px 12px; }
  ul button {
    display: block;
    width: 100%;
    text-align: start;
    padding: 13px 14px;
    border-radius: 12px;
    font-size: 0.95rem;
    color: var(--text-secondary);
    transition: background 0.15s;
  }
  ul button:hover { background: var(--bg-hover); }
  ul button.current {
    background: var(--bg-hover);
    color: var(--accent-deep);
    font-weight: 500;
  }

  .footer {
    margin-top: auto;
    padding: 16px 22px;
    border-top: 1px solid var(--border);
  }
</style>

<!-- pwa-kit: save/ui/SaveStatus.svelte v3 -->
<script lang="ts">
  // Subtle autosave indicator next to an editor. Idle renders nothing -
  // autosave is the norm, not news. While a write is in flight a small
  // spinner appears (150ms delay so quick saves barely flash); when it
  // lands a checkmark flashes and fades. Failure is the only state that
  // earns words: a persistent tappable retry. Seams: errorText, timings.
  import { fade } from 'svelte/transition'
  import type { SaveTracker } from '../lib/save-tracker.svelte'

  let {
    tracker,
    errorText = 'Save failed · retry',
  }: { tracker: SaveTracker; errorText?: string } = $props()

  // 'saved' is transient in the UI: flash the check, then fade it away.
  let showSaved = $state(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  $effect(() => {
    if (tracker.status === 'saved') {
      showSaved = true
      timer = setTimeout(() => (showSaved = false), 1200)
    } else {
      showSaved = false
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  })
</script>

<span class="save-status" aria-live="polite">
  {#if tracker.status === 'error'}
    <button class="error" in:fade={{ duration: 150 }} onclick={() => tracker.retry()}>
      {errorText}
    </button>
  {:else if tracker.status === 'saving'}
    <svg class="spinner" in:fade={{ duration: 150, delay: 150 }} viewBox="0 0 16 16" width="14" height="14" role="status">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" opacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  {:else if showSaved}
    <svg class="check" out:fade={{ duration: 400 }} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  {/if}
</span>

<style>
  /* Reserve a small square so appearing/disappearing never shifts layout
     (the error text is wider, but errors are rare and deserve the space). */
  .save-status {
    display: inline-grid;
    min-width: 16px;
    min-height: 16px;
    align-items: center;
    justify-items: center;
  }
  .save-status > :global(*) {
    grid-area: 1 / 1;
    white-space: nowrap;
  }

  .spinner {
    color: var(--text-secondary);
    animation: save-spin 0.8s linear infinite;
  }
  @keyframes save-spin {
    to { transform: rotate(360deg); }
  }

  .check { color: var(--ok, #16a34a); }

  .error {
    color: var(--danger, #dc2626);
    cursor: pointer;
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    font-size: 0.8rem;
    line-height: 1.2;
    text-decoration: underline;
  }
</style>

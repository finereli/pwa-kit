<script lang="ts">
  // Always-visible autosave indicator next to an editor. Idle state is the
  // hint that changes save themselves; then saving / saved / a tappable
  // retry on failure. States are grid-stacked so a swap never shifts layout.
  // Seams: the four strings.
  import { fade } from 'svelte/transition'
  import type { SaveTracker } from '../lib/save-tracker.svelte'

  let {
    tracker,
    idleText = 'Changes save automatically',
    savingText = 'Saving...',
    savedText = '✓ Saved',
    errorText = 'Save failed · retry',
  }: { tracker: SaveTracker; idleText?: string; savingText?: string; savedText?: string; errorText?: string } = $props()
</script>

<span class="save-status">
  {#key tracker.status}
    {#if tracker.status === 'error'}
      <button class="state error" in:fade={{ duration: 150 }} onclick={() => tracker.retry()}>
        {errorText}
      </button>
    {:else if tracker.status === 'saving'}
      <span class="state saving" in:fade={{ duration: 150 }}>{savingText}</span>
    {:else if tracker.status === 'saved'}
      <span class="state saved" in:fade={{ duration: 150 }}>{savedText}</span>
    {:else}
      <span class="state idle" in:fade={{ duration: 150 }}>{idleText}</span>
    {/if}
  {/key}
</span>

<style>
  .save-status {
    display: inline-grid;
    min-height: 1.2em;
    align-items: center;
  }
  /* Stack transitioning states so a swap never shifts the layout. */
  .save-status > :global(*) {
    grid-area: 1 / 1;
    white-space: nowrap;
  }
  .state { font-size: 0.8rem; line-height: 1.2; }
  .idle, .saving { color: var(--text-secondary); }
  .saved { color: var(--ok, #16a34a); }
  .error {
    color: var(--danger, #dc2626);
    cursor: pointer;
    padding: 0;
    background: none;
    border: none;
    font: inherit;
    font-size: 0.8rem;
    text-decoration: underline;
  }
</style>

<!-- pwa-kit: theme/ui/AppearancePicker.svelte v2 -->
<script lang="ts">
  // Light / Dark / Match device, as a segmented control. Shares the appearance
  // rune with the sidebar's one-tap toggle, so the two never disagree.
  import { appearance, type Mode } from '../lib/appearance.svelte'

  const MODES: { id: Mode; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'device', label: 'Match device' },
  ]
</script>

<div class="modes" role="radiogroup" aria-label="Appearance">
  {#each MODES as m (m.id)}
    <button
      class="mode"
      class:on={appearance.mode === m.id}
      role="radio"
      aria-checked={appearance.mode === m.id}
      onclick={() => appearance.set(m.id)}
    >{m.label}</button>
  {/each}
</div>

<style>
  .modes {
    display: inline-flex; flex-wrap: wrap; gap: 4px; padding: 3px;
    border-radius: 999px; background: var(--bg-message, var(--bg-hover));
  }
  .mode { padding: 7px 14px; border-radius: 999px; font-size: 0.85rem; color: var(--text-secondary); }
  .mode:hover { color: var(--text-primary); }
  .mode.on { background: var(--bg-surface); color: var(--text-primary); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); }
  .mode:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>

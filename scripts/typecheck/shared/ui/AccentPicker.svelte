<!-- pwa-kit: theme/ui/AccentPicker.svelte v2 -->
<script lang="ts">
  // Preset swatches plus a rainbow circle that opens the native colour picker.
  // `value` is the saved accent (null = the default); `onpick` saves (null for
  // the default, so the default stays the app's to change later); `onpreview`
  // applies a colour live while the native picker is being dragged.
  import { ACCENTS, DEFAULT_ACCENT } from '../lib/accent'

  let { value, onpick, onpreview, disabled = false }: {
    value: string | null; onpick: (hex: string | null) => void; onpreview?: (hex: string) => void; disabled?: boolean
  } = $props()

  const current = $derived((value ?? DEFAULT_ACCENT).toLowerCase())
  const custom = $derived(!ACCENTS.some(a => a.hex === current))
</script>

<div class="swatches" role="radiogroup" aria-label="Accent color">
  {#each ACCENTS as a (a.hex)}
    <button
      class="swatch"
      class:on={current === a.hex}
      style="background: {a.hex}"
      role="radio"
      aria-checked={current === a.hex}
      aria-label={a.name}
      title={a.name}
      {disabled}
      onclick={() => onpick(a.hex === DEFAULT_ACCENT ? null : a.hex)}
    ></button>
  {/each}
  <!-- Any colour: previews while dragging, saves when the picker closes. -->
  <label class="swatch custom" class:on={custom} title="Pick any color" style={custom ? `--picked: ${current}` : ''}>
    <input
      type="color"
      aria-label="Custom color"
      value={current}
      {disabled}
      oninput={(e) => onpreview?.(e.currentTarget.value)}
      onchange={(e) => onpick(e.currentTarget.value)}
    />
  </label>
</div>

<style>
  /* Padding leaves room for the selected ring, which sits outside the circle. */
  .swatches { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 4px 2px; }
  .swatch { width: 32px; height: 32px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
  /* clip-path, not just border-radius: the native colour input paints its own
     square swatch, and overflow clipping does not always round it. That also
     clips outlines, so this swatch draws its rings inside with box-shadow. */
  .swatch.custom {
    position: relative; display: block; border: 0; outline: none;
    clip-path: circle(50%);
    background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  }
  .swatch.custom.on { box-shadow: inset 0 0 0 5px var(--picked), inset 0 0 0 7px var(--bg-surface); }
  .swatch.custom:focus-within { box-shadow: inset 0 0 0 2px var(--bg-surface), inset 0 0 0 4px var(--text-primary); }
  .swatch.custom input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; opacity: 0; cursor: pointer; }
  .swatch.on:not(.custom) { outline: 2px solid var(--text-primary); outline-offset: 2px; }
  .swatch:focus-visible { outline: 2px solid var(--text-primary); outline-offset: 2px; }
  .swatch:disabled { opacity: 0.5; cursor: default; }
</style>

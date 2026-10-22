# confirm

`ConfirmButton`: the inline two-step confirmation for destructive actions. Spec: `reference/behavior.md` → Save model ("Confirmations are inline two-step").

`ui/ConfirmButton.svelte` → `shared/ui/`.

```svelte
<ConfirmButton class="menu-row" onconfirm={del}>
  <Icon name="delete" size={20} /> Delete
</ConfirmButton>
```

## Decisions baked in

- First tap arms, second tap acts. The label becomes "Sure?": the button already said what it does, so the prompt only has to ask. A longer `confirmLabel` is for when the consequence isn't visible from the button.
- Arming changes the words only, never the shape. A menu row stays a row, a text link stays a link, a solid button stays solid: the host's `class` decides the look; the component adds the danger colour and `.armed` (weight 600).
- Disarms itself after 3 s or on blur, so a stray first tap is forgotten.
- `stopPropagation` on the tap, so arming a button inside a tappable card or row doesn't open it.
- No `confirm()`: the native dialog renders in the browser's language, not the app's.
- Pair with an undo where the data allows (the delete still offers Undo afterwards); the confirm is for the slip, the undo for the regret.

## Seams

`confirmLabel` (default "Sure?"), `ms`, `class` (shape), any other attributes pass through to the button.

## Verify

Tap once: label reads "Sure?", the button keeps its size and shape, nothing happens underneath. Wait 3 s: back to the original label. Tap twice: the action runs once.

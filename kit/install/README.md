# install

Install nudge as a lower-third slide-in, not a modal. Spec: `reference/behavior.md` → Install prompts.

`ui/InstallBanner.svelte` → `shared/ui/` (needs `Icon.svelte` from `icons/` beside it: install_mobile, close, ios_share, more_vert); `src/pwa-install.d.ts` → `src/`; the inline capture is in `shell/index.html`. Prop `when` is the engagement trigger (`player.playing && player.position >= 10`). Baked in: never in standalone; dismiss is session-only; Android taps `prompt()`, iOS expands the share-icon steps; listeners cleaned up in `$effect`. Seams: strings, `bottom` offset, highlight colour.

Verify: Android Chrome shows the native prompt on tap; iOS Safari expands steps; installed app never shows it; dismissed banner returns next visit.

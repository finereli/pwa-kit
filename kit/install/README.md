# install

Install nudge as a small card that drops in from the top, under the top bar, not a modal. Spec: `reference/behavior.md` → Asks.

`ui/InstallBanner.svelte` → `shared/ui/` (needs `Icon.svelte` from `icons/` beside it: install_mobile, close, ios_share, more_vert); `src/pwa-install.d.ts` → `src/`; the inline capture is in `shell/index.html`. Prop `when` is the engagement trigger (`player.playing && player.position >= 10`); `ondismiss` fires when it closes or the app installs, for chaining the next onboarding step (a notifications offer). Bind `visible` to hold the notifications ask (kit push/ PushBanner) back while this one is up. Baked in: from the top (the bottom of most apps is taken); never in standalone; dismiss is session-only; Android taps `prompt()`, iOS expands the share-icon steps; listeners cleaned up in `$effect`. Seams: strings, `top` offset, highlight colour.

Verify: Android Chrome shows the native prompt on tap; iOS Safari expands steps; installed app never shows it; dismissed banner returns next visit.

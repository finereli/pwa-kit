# settings

Settings pages that start flat and grow into an index of sub-pages without a rewrite. Spec: `reference/behavior.md` → Settings.

## Files

| Kit file | Goes to |
|---|---|
| `ui/SettingsPage.svelte`, `ui/SettingsRow.svelte` | `shared/ui/` |
| `css/settings.css` | `shared/css/` (imported by SettingsPage) |

## Two shapes, one frame

**Flat** (start here): one `#/settings` route, one `<SettingsPage title="Settings">` with `<section><h3>…</h3><p class="hint">…</p>…</section>` blocks. Fine while there are a handful of settings - say up to four or five sections that fit on a phone screen.

**Multi-pane** (when it gets long, or a section grows its own sub-pages like a list of connections): `#/settings` becomes an index of `SettingsRow`s, each section moves to its own `SettingsPage` with `back="/settings"`, and the routes become `#/settings/<section>` (and `#/settings/<section>/<id>` for a detail page). The section markup moves over unchanged, which is the point: the frame, the classes and the styles are the same in both shapes.

```svelte
<SettingsPage title="Settings">
  <ul class="rows">
    <SettingsRow href="#/settings/theme" title="Theme" sub={`${modeLabel}, ${accentName}`} />
    <SettingsRow href="#/settings/account" title="Account" sub={user.email} />
  </ul>
</SettingsPage>
```

## Decisions baked in

- Rows summarize current state, not contents (see SettingsRow's comment).
- Account details (email, sign-out, delete my data) live on an Account page. The drawer footer shows avatar + name (`shell/ui/AccountMenu`), then the light/dark icon, the settings gear, the reload icon and the version (reference/shell.md → Sidebar).
- On mobile the top bar shows the title and, on sub-pages, a back arrow (`TopBar leading="back"`, its target is the parent route); SettingsPage hides its own `h2` and back link there. On desktop SettingsPage shows both.
- Borderless rows with hairline separators, hover tint - not cards. Status dots: `.dot.ok / .warn / .error`.
- Buttons: `.apply-btn` (primary pill), `.quiet-btn` (outline, `.neutral` for non-destructive), `.danger-btn` (`.solid` for the confirm step). Two-step inline confirms, never `confirm()` (kit `confirm/`, ConfirmButton).
- Max width 42rem, centred.

## Seams

Section list and summaries; the router's `settings` view with a `section` param and a `parentOf(route)` for the top bar's back arrow.

## Verify

Phone: index rows tap through, top bar back arrow returns to the index, no duplicate title. Desktop: back link visible on sub-pages, not on the index. RTL: chevrons and back arrow flip.

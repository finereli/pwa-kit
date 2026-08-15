# share

`shareUrl(url)`: system share sheet on phones, clipboard on desktops, URL only. `lib/web-share.ts` → `shared/lib/`. The app builds its own deep links (`itemUrl(id)` = hash route on the production origin) and shows the invite variant of Login to signed-out arrivals (Login `children`). Spec: `reference/behavior.md` → Sharing. Verify: phone → share sheet, WhatsApp preview from the URL alone; desktop → "link copied"; dismissing the sheet shows nothing.

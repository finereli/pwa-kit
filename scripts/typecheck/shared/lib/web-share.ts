// pwa-kit: share/lib/web-share.ts v1
// Hand a URL to the person: the system share sheet on phones, the clipboard
// on desktops (the desktop share sheet has no WhatsApp Web in it, so copying
// is what a person actually wants there). URL only, no text - the receiving
// app makes its own preview.
//
// Resolves to 'shared' | 'copied' | 'dismissed' | 'failed'. 'dismissed' is the
// sheet closed without picking anything and deserves no feedback; 'copied'
// deserves a small inline confirmation ("link copied"); 'shared' is its own
// confirmation.
//
// Deep links: use the app's hash route (`https://app.example.com/#/play/<id>`)
// - it survives an app restart from the home screen, and on Android an
// installed app captures it. iOS opens links in Safari (no link capturing for
// home-screen web apps), so there the recipient lands in the browser copy of
// the app - same route, same login. Someone arriving signed out should see
// what they were sent (Login's `children` snippet), and the hash survives
// sign-in.

export type ShareResult = 'shared' | 'copied' | 'dismissed' | 'failed'

export async function shareUrl(url: string): Promise<ShareResult> {
  const touch = matchMedia('(hover: none)').matches
  if (touch && navigator.share) {
    try {
      await navigator.share({ url })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'dismissed'
      // Fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

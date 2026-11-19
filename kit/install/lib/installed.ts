// pwa-kit: install/lib/installed.ts v4
// Whether the app is installed on this device, remembered so a browser tab
// can know it. Browsers don't tell a tab that its app is installed, but they
// do tell it at the moments that matter:
//
//   - the app runs in standalone mode: installed;
//   - `appinstalled` fires (our banner, or Chrome's own menu): installed;
//   - `beforeinstallprompt` fires: the browser offers to install, so it isn't
//     (uninstalled since) - forget it.
//
// What it's for: once the app is installed, the next step happens in the
// app, not the tab. Try, install, use, then notifications - so PushBanner
// waits for the installed app instead of asking in the tab the install
// started from (reference/behavior.md, Asks). Import it once, early (the
// banners do); the listeners are set up on import.

const KEY = 'pwa.installed.v1'

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

export function markInstalled(on = true) {
  try {
    on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY)
  } catch {}
}

export function installed(): boolean {
  if (isStandalone()) return true
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

// A browser tab on a device where the app is installed: things that belong
// to the app (asking for notifications) should wait for it.
export const tabWithAppInstalled = () => !isStandalone() && installed()

if (typeof window !== 'undefined') {
  if (isStandalone()) markInstalled()
  // Captured before the bundle loaded (shell index.html): offered, so not installed.
  if ((window as Window & { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt) markInstalled(false)
  addEventListener('appinstalled', () => markInstalled())
  addEventListener('beforeinstallprompt', () => markInstalled(false))
}

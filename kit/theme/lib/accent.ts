// pwa-kit: theme/lib/accent.ts v2
// The person's accent colour. Saved per user on the server (it follows them
// across devices); this device caches it so the first paint is already right.
// Call setAccent(storedAccent()) in main.ts before mount, and again whenever the
// server's value arrives or changes. Apps without a runtime icon drop the
// applyAppIcon line.
import { applyAccent, isDark } from '$shared/lib/theme'
import { applyAppIcon } from './appicon'

// Hues tuned to stay legible in both modes; applyAccent derives the rest of the scale.
export const ACCENTS: { name: string; hex: string }[] = [
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Green', hex: '#22a45d' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Red', hex: '#e5484d' },
  { name: 'Pink', hex: '#d6409f' },
  { name: 'Violet', hex: '#9b5de5' },
]
export const DEFAULT_ACCENT = ACCENTS[0]!.hex

const KEY = 'app.accent.v1' // seam: the app's storage prefix

export function storedAccent(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

// Apply the person's accent (null = the stylesheet default) and cache it so the
// next load paints in the right colour before the socket answers.
export function setAccent(hex: string | null) {
  try {
    if (hex) localStorage.setItem(KEY, hex)
    else localStorage.removeItem(KEY)
  } catch { /* private mode: fine */ }
  // The default accent keeps the shipped icon files.
  void applyAppIcon(hex === DEFAULT_ACCENT ? null : hex)
  if (hex) {
    applyAccent(hex, isDark())
  } else {
    const root = document.documentElement.style
    for (const k of ['--c-50', '--c-100', '--c-300', '--c-400', '--c-500', '--c-600', '--accent', '--accent-deep', '--accent-light', '--accent-soft']) root.removeProperty(k)
  }
}

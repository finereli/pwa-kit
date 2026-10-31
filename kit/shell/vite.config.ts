// pwa-kit: shell/vite.config.ts v13
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { buildNumber, pwaOptions } from '../shared/build/pwa-build'

// Seams: MAJOR, the manifest, includeAssets.
const MAJOR = 1

export default defineConfig({
  define: {
    __BUILD__: JSON.stringify(buildNumber(MAJOR)),
  },
  resolve: {
    // Code shared between the repo's PWAs (or just this one) - see shared/README.md
    alias: { $shared: fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  plugins: [
    svelte(),
    VitePWA(
      pwaOptions({
        includeAssets: ['fonts/*.woff2', 'icons/*.png'],
        manifest: {
          name: 'My App',
          short_name: 'My App',
          description: '',
          lang: 'en',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          // The splash screen: the page colour (--bg-surface) of the theme the
          // owner uses. No theme_color: Android paints the navigation bar with
          // it, one colour for light and dark; without it the bar follows the
          // phone (reference/shell.md -> Manifest). pwaOptions keeps it out.
          background_color: '#faf6f0',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      })
    ),
  ],
})

// pwa-kit: auth/functions/api/_config.ts v7
// The one place an app's server-side auth constants live. Seam: fill these in.
export const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'
// Admin apps set this to true: sessions of users without `is_admin` are refused.
export const REQUIRE_ADMIN = false
// Path prefixes under /api/ that need no credential (public, CDN-cached
// content). Everything else 401s without one. /api/auth is always open.
export const PUBLIC_PATHS: string[] = []

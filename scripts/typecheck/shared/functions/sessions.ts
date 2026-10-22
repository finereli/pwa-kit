// pwa-kit: auth/functions/sessions.ts v7
// Server-issued session tokens, stored in the D1 `sessions` table
// (schema: db/auth.sql).
//
// Google ID tokens expire after ~1 hour, so the client can't reuse them as a
// long-lived credential. /api/auth exchanges a verified Google credential for
// one of these instead: 90 days, revocable by deleting the row.

export interface SessionUser {
  google_id: string
  email: string
  is_admin: number
}
export interface DevUser {
  sub: string
  email: string
  is_admin: number
}

export async function createSession(db: D1Database, googleId: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = 'sess_' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`),
    db.prepare(
      `INSERT INTO sessions (token, google_id, expires_at)
       VALUES (?1, ?2, datetime('now', '+90 days'))`
    ).bind(token, googleId),
  ])
  return token
}

// Returns { google_id, email, is_admin } for a live session token, else null.
export async function validateSession(db: D1Database, token: string | undefined): Promise<SessionUser | null> {
  if (!token?.startsWith('sess_')) return null
  try {
    const row = await db.prepare(
      `SELECT s.google_id, u.email, u.is_admin
       FROM sessions s JOIN users u ON u.google_id = s.google_id
       WHERE s.token = ?1 AND s.expires_at > datetime('now')`
    ).bind(token).first<SessionUser>()
    return row ?? null
  } catch {
    return null
  }
}

export async function deleteSession(db: D1Database, token: string | undefined): Promise<void> {
  if (!token?.startsWith('sess_')) return
  try {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  } catch {}
}

// Local-development bypass. Accepts the literal token 'dev-token' only when
// BOTH hold: the deployment opted in via the DEV_AUTH env var, and the request
// host is local or a pages.dev preview (never a production hostname). Preview
// deployments get DEV_AUTH plus their own isolated preview database - see
// the infra kit's setup-preview.sh - so this grants nothing in production.
// A hostname check alone is NOT an auth boundary: previews once bound the
// production database, and any preview URL was full admin access.
//
// `devUser` must match the client's devUser (lib/google-auth.svelte.ts).
export const DEFAULT_DEV_USER: DevUser = { sub: '100000000000000000001', email: 'dev@example.com', is_admin: 1 }

export function devBypassUser(token: string | undefined, url: URL, env: { DEV_AUTH?: string }, devUser: DevUser = DEFAULT_DEV_USER): DevUser | null {
  if (token !== 'dev-token') return null
  if (env.DEV_AUTH !== 'allow') return null
  const h = url.hostname
  const isDevHost = h === 'localhost' || h === '127.0.0.1' || h.endsWith('.pages.dev')
  if (!isDevHost) return null
  return devUser
}

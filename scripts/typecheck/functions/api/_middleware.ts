// pwa-kit: auth/functions/api/_middleware.ts v5
// Every /api/* request except /api/auth and PUBLIC_PATHS must carry a live credential.
// Order: dev bypass (double-locked) → server session → raw Google id_token
// (accepted so a client whose /api/auth POST failed can still get through
// for the hour the token lives; it re-exchanges on the next sign-in).
//
// Sets context.data.user = { sub, email } for handlers downstream. Handlers
// derive the user from this and never from client-supplied ids.

import { verifyGoogleToken } from '../../shared/functions/google-token'
import { validateSession, devBypassUser } from '../../shared/functions/sessions'
import { CLIENT_ID, REQUIRE_ADMIN, PUBLIC_PATHS } from './_config'

interface Env { DB: D1Database; DEV_AUTH?: string }
export type AuthedData = { user: { sub: string; email: string } }

export const onRequest: PagesFunction<Env, string, AuthedData> = async (context) => {
  const { request, env, next } = context
  const url = new URL(request.url)

  if (url.pathname === '/api/auth') return next()
  if (PUBLIC_PATHS.some((p) => url.pathname.startsWith(p))) return next()

  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const dev = devBypassUser(token, url, env)
  if (dev) {
    context.data.user = { sub: dev.sub, email: dev.email }
    return next()
  }

  if (token.startsWith('sess_')) {
    const sess = await validateSession(env.DB, token)
    if (!sess) return Response.json({ error: 'unauthorized' }, { status: 401 })
    if (REQUIRE_ADMIN && !sess.is_admin) return Response.json({ error: 'forbidden' }, { status: 403 })
    context.data.user = { sub: sess.google_id, email: sess.email }
    return next()
  }

  try {
    const payload = await verifyGoogleToken(token, CLIENT_ID)
    if (REQUIRE_ADMIN) {
      const row = await env.DB.prepare('SELECT is_admin FROM users WHERE google_id = ?').bind(payload.sub).first<{ is_admin: number }>()
      if (!row?.is_admin) return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    context.data.user = { sub: payload.sub, email: payload.email }
    return next()
  } catch {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
}

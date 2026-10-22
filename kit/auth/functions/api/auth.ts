// pwa-kit: auth/functions/api/auth.ts v7
// POST /api/auth  { credential: "<google id_token>" }
// Verifies the token against Google's public keys, upserts into D1, and
// returns the user record plus a 90-day session token. The session is what
// authenticates later API calls - the Google token itself only lives about
// an hour. DELETE /api/auth revokes the session (sign-out).
//
// Import paths assume the family layout: shared/ beside the app directory
// (repo/shared, repo/app/functions/api). A single-app repo with shared/ inside
// the app uses `../../shared/functions/…`.

import { verifyGoogleToken } from '../../../shared/functions/google-token'
import { createSession, deleteSession } from '../../../shared/functions/sessions'
import { CLIENT_ID } from './_config'

interface Env { DB: D1Database; DEV_AUTH?: string }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { credential } = (await request.json()) as { credential?: string }
    if (!credential) {
      return Response.json({ error: 'missing credential' }, { status: 400 })
    }

    const payload = await verifyGoogleToken(credential, CLIENT_ID)

    await env.DB.prepare(
      `INSERT INTO users (google_id, email, name, picture)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(google_id) DO UPDATE SET
         email = ?2, name = ?3, picture = ?4,
         last_seen = datetime('now')`
    )
      .bind(payload.sub, payload.email, payload.name, payload.picture)
      .run()

    const row = await env.DB.prepare(
      'SELECT is_admin FROM users WHERE google_id = ?'
    ).bind(payload.sub).first<{ is_admin: number }>()
    const isAdmin = row?.is_admin ?? 0

    const session = await createSession(env.DB, payload.sub)

    return Response.json({
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      is_admin: isAdmin,
      session,
    })
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 401 })
  }
}

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  await deleteSession(env.DB, token)
  return Response.json({ ok: true })
}

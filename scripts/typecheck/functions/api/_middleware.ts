// pwa-kit: pin-auth/functions/api/_middleware.ts v2
// Everything under /api/ requires the PIN. The PWA sends `Authorization:
// Bearer <pin>`; a CLI can send `x-pin`. The PIN itself lives in the PIN env
// var (a Pages secret in production, .dev.vars locally) - never in source.
//
// Self-contained on purpose: no imports, so it drops into any Pages project.
// If the app has an api/_lib.ts, feel free to move the helpers there.

interface Env {
  PIN: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  if (!env.PIN)
    return new Response(JSON.stringify({ error: 'Server missing PIN configuration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })

  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  const pin = request.headers.get('x-pin') ?? bearer

  if (!pin || pin !== env.PIN)
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  return context.next()
}

// pwa-kit: pin-auth/functions/api/auth/check.ts v2
// The middleware has already validated the PIN by the time this runs, so
// reaching here IS the success. PinLogin submits against this endpoint.
export const onRequestGet: PagesFunction = async () =>
  new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })

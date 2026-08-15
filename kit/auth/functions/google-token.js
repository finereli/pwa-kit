// Verification of Google ID tokens against Google's published keys, for
// Cloudflare Pages Functions / Workers (WebCrypto, no dependencies).
//
// The key cache is module-level, so within one isolate the certs are fetched
// at most once an hour. The expected audience (your OAuth client id) is
// passed in; keep it in one place, e.g. functions/api/_config.js.

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'

let cachedKeys = null
let cacheExpiry = 0

async function getGoogleKeys() {
  if (cachedKeys && Date.now() < cacheExpiry) return cachedKeys
  const res = await fetch(GOOGLE_CERTS_URL)
  const { keys } = await res.json()
  cachedKeys = keys
  cacheExpiry = Date.now() + 3600_000
  return keys
}

function decodeBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (str.length % 4)) % 4)
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

export async function verifyGoogleToken(credential, clientId) {
  if (!clientId) throw new Error('verifyGoogleToken: clientId is required')
  const [headerB64, payloadB64, signatureB64] = credential.split('.')
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(headerB64)))
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadB64)))

  if (payload.aud !== clientId) throw new Error('bad audience')
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com')
    throw new Error('bad issuer')
  if (payload.exp < Date.now() / 1000) throw new Error('expired')

  const keys = await getGoogleKeys()
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('unknown key')

  const key = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  )

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = decodeBase64Url(signatureB64)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)
  if (!valid) throw new Error('bad signature')

  return payload
}

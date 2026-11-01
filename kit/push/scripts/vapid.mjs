// pwa-kit: push/scripts/vapid.mjs v3
// Make the VAPID key pair that signs this app's push messages. Run once and
// put the three lines in the app's secrets. Never regenerate them for an app
// that has subscribers: every subscription is bound to the public key, and a
// new pair silently stops push on every device.
//   node vapid.mjs https://myapp.example
import { webcrypto } from 'node:crypto'

const subject = process.argv[2] || 'mailto:you@example.com'
const b64u = (buf) => Buffer.from(buf).toString('base64url')
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
console.log(`VAPID_PUBLIC_KEY=${b64u(await webcrypto.subtle.exportKey('raw', pair.publicKey))}`)
console.log(`VAPID_PRIVATE_KEY=${(await webcrypto.subtle.exportKey('jwk', pair.privateKey)).d}`)
console.log(`VAPID_SUBJECT=${subject}`)

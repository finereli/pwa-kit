// pwa-kit: push/test/web-push.test.ts v2
// The two halves that are easy to get subtly wrong, checked against the
// other side: the browser's decryption of an RFC 8291 message, and a
// verifier's check of the VAPID signature. Run with vitest from the app
// (copy next to its other tests and point the import at the copied file).
import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { encryptPayload, vapidToken } from '../functions/web-push'

type Bytes = Uint8Array<ArrayBuffer>
const subtle = webcrypto.subtle as unknown as SubtleCrypto
const utf8 = (s: string): Bytes => new Uint8Array(new TextEncoder().encode(s))
const b64uEncode = (b: Uint8Array | ArrayBuffer) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url')
const b64uDecode = (s: string): Bytes => new Uint8Array(Buffer.from(s, 'base64url'))
const concat = (...parts: Uint8Array[]): Bytes => new Uint8Array(Buffer.concat(parts))

describe('web push', () => {
  it('encrypts a payload the browser side can decrypt (RFC 8291)', async () => {
    // Play the browser: make its key pair and auth secret, then decrypt.
    const ua = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
    const uaPublic = new Uint8Array(await subtle.exportKey('raw', ua.publicKey))
    const auth = webcrypto.getRandomValues(new Uint8Array(16))
    const message = JSON.stringify({ title: 'Ana replied', body: 'Did you consider the offline case?' })

    const body = await encryptPayload(utf8(message), uaPublic, auth)

    const salt = body.slice(0, 16)
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096)
    const idLen = body[20]
    expect(idLen).toBe(65)
    const serverPublic = body.slice(21, 21 + idLen)
    const sealed = body.slice(21 + idLen)

    const serverKey = await subtle.importKey('raw', serverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: serverKey }, ua.privateKey, 256))
    const hkdf = async (s: Bytes, ikm: Bytes, info: Bytes, n: number) =>
      new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8))
    const ikm = await hkdf(auth, shared, concat(utf8('WebPush: info\0'), uaPublic, serverPublic), 32)
    const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
    const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)
    const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), sealed))

    expect(plain[plain.length - 1]).toBe(2)
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe(message)
  })

  it('signs a VAPID token the public key verifies', async () => {
    const pair = (await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
    const pub = b64uEncode(new Uint8Array(await subtle.exportKey('raw', pair.publicKey)))
    const priv = (await subtle.exportKey('jwk', pair.privateKey)).d!
    const jwt = await vapidToken('https://push.example', 'mailto:a@b.c', pub, priv, 1_700_000_000_000)
    const [head, claims, sig] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(b64uDecode(claims)))).toEqual({ aud: 'https://push.example', exp: 1_700_000_000 + 43200, sub: 'mailto:a@b.c' })
    expect(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, b64uDecode(sig), utf8(`${head}.${claims}`))).toBe(true)
  })
})

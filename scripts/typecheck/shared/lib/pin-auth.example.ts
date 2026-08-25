// pwa-kit: pin-auth/lib/pin-auth.example.ts v1
// PIN auth for single-user apps: the PIN is the credential, not a session.
// Stored raw in localStorage, sent as `Bearer <pin>` on every request; a 401
// anywhere clears it and drops back to the keypad. Copy to
// src/lib/auth.svelte.ts and set the storage key.
//
// Why no session layer: one user, one secret, no server state to expire or
// prune. The PIN lives as a Pages secret (env.PIN); rotating it signs the
// user out everywhere at once. Satisfies the ApiAuth contract of the `api`
// kit item (token + handleUnauthorized), so makeApi(auth) just works.

const KEY = 'myapp.pin.v1' // seam: per-app prefix so PINs don't leak across localhost apps

class Auth {
  pin = $state<string | null>(localStorage.getItem(KEY))

  get signedIn(): boolean {
    return this.pin !== null
  }

  get token(): string | undefined {
    return this.pin ?? undefined
  }

  // Optimistic boot: a stored PIN shows the app immediately; the first API
  // call re-validates and a 401 funnels back here.
  init() {}

  async submit(pin: string): Promise<boolean> {
    const res = await fetch('/api/auth/check', { headers: { Authorization: `Bearer ${pin}` } })
    if (!res.ok) return false
    this.pin = pin
    localStorage.setItem(KEY, pin)
    return true
  }

  handleUnauthorized() {
    this.signOut()
  }

  signOut() {
    this.pin = null
    localStorage.removeItem(KEY)
  }
}

export const auth = new Auth()

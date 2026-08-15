// Google sign-in via Identity Services, with server-issued sessions.
//
// The flow: GSI hands us a short-lived ID token, we POST it to /api/auth,
// and the server answers with the user record plus a 90-day session token.
// From then on the session token is the credential. The page URL never
// changes, so hash-based deep links survive sign-in untouched.
//
// Each app instantiates this once (src/lib/auth.svelte.ts):
//
//   export const auth = new GoogleAuth({
//     clientId: '….apps.googleusercontent.com',
//     storageKey: 'myapp-user',
//     devHostSuffix: '.myapp.pages.dev',
//   })
//
// Seams: clientId (required), storageKey, devHostSuffix, devUser (defaults to
// the dev identity; must match devBypassUser on the server).

export interface AuthUser {
  id: string
  name: string
  email: string
  picture: string
  isAdmin: boolean
  credential: string
}

export interface GoogleAuthOptions {
  clientId: string
  storageKey: string
  devHostSuffix?: string
  devUser?: AuthUser
}

// Minimal typing for the bits of Google Identity Services we touch.
declare const google: {
  accounts: {
    id: {
      initialize(opts: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }): void
      prompt(cb?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void
      disableAutoSelect(): void
    }
  }
}

export const DEFAULT_DEV_USER: AuthUser = {
  id: '100000000000000000001',
  name: 'Dev User',
  email: 'dev@example.com',
  picture: '',
  isAdmin: true,
  credential: 'dev-token',
}

export class GoogleAuth {
  user = $state<AuthUser | null>(null)
  #ready = $state(false)
  #clientId: string
  #storageKey: string
  #devHostSuffix: string | undefined
  #devUser: AuthUser
  // Sign-in/out listeners, so stores holding per-user data can reset.
  #listeners: Array<(u: AuthUser | null) => void> = []

  constructor({ clientId, storageKey, devHostSuffix, devUser = DEFAULT_DEV_USER }: GoogleAuthOptions) {
    if (!clientId) throw new Error('GoogleAuth: clientId is required')
    this.#clientId = clientId
    this.#storageKey = storageKey
    this.#devHostSuffix = devHostSuffix
    this.#devUser = devUser
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try { this.user = JSON.parse(saved) } catch { localStorage.removeItem(storageKey) }
    }
  }

  get ready() { return this.#ready }
  get signedIn() { return !!this.user }
  get isAdmin() { return !!this.user?.isAdmin }
  get token() { return this.user?.credential }

  // Local dev and pages.dev preview deployments skip Google login entirely -
  // the API side accepts 'dev-token' from these hosts when the deployment has
  // opted in (DEV_AUTH env var; previews get an isolated preview database).
  // The bare production alias never matches the suffix by design.
  #isDevEnv() {
    const h = location.hostname
    return h === 'localhost' || h === '127.0.0.1' || (this.#devHostSuffix && h.endsWith(this.#devHostSuffix))
  }

  onChange(fn: (u: AuthUser | null) => void) {
    this.#listeners.push(fn)
  }

  #notify() {
    for (const fn of this.#listeners) fn(this.user)
  }

  async init() {
    if (this.#isDevEnv()) {
      if (!this.user) {
        this.user = this.#devUser
        localStorage.setItem(this.#storageKey, JSON.stringify(this.#devUser))
      }
      this.#ready = true
      return
    }
    if (this.user?.credential === 'dev-token') {
      this.user = null
      localStorage.removeItem(this.#storageKey)
    }
    await this.#loadGsi()
    google.accounts.id.initialize({
      client_id: this.#clientId,
      callback: (response) => this.#onCredential(response),
      auto_select: true,
    })
    this.#ready = true
  }

  signIn() {
    if (!this.#ready) return
    google.accounts.id.prompt((notification) => {
      // If One Tap is dismissed or unavailable, fall back to the popup flow.
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        this.#popupFallback()
      }
    })
  }

  signOut() {
    const token = this.token
    if (token?.startsWith('sess_')) {
      fetch('/api/auth', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    if (this.user) { try { google.accounts.id.disableAutoSelect() } catch {} }
    this.user = null
    localStorage.removeItem(this.#storageKey)
    this.#notify()
  }

  // A 401 from the API means the stored session is dead (expired, revoked).
  // Drop it and re-prompt; with auto_select this is usually seamless.
  handleUnauthorized() {
    if (!this.user) return
    this.user = null
    localStorage.removeItem(this.#storageKey)
    this.#notify()
    try { google.accounts.id.prompt() } catch {}
  }

  async #onCredential(response: { credential: string }) {
    const payload = JSON.parse(atob(response.credential.split('.')[1])) as { sub: string; name: string; email: string; picture: string }
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    })
    // Even if the server is unreachable the local decode can sign the user in;
    // API calls that need the server will 401 and re-prompt.
    const data = (res.ok ? await res.json() : {}) as { session?: string; is_admin?: number }

    this.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      isAdmin: !!data.is_admin,
      // Prefer the long-lived server session; the Google ID token itself
      // expires after an hour, which used to log people out on every update.
      credential: data.session || response.credential,
    }
    localStorage.setItem(this.#storageKey, JSON.stringify(this.user))
    this.#notify()
  }

  #popupFallback() {
    const width = 450, height = 550
    const left = (screen.width - width) / 2
    const top = (screen.height - height) / 2
    const params = new URLSearchParams({
      client_id: this.#clientId,
      redirect_uri: location.origin,
      response_type: 'id_token',
      scope: 'openid profile email',
      nonce: crypto.randomUUID(),
      prompt: 'select_account',
    })
    const popup = window.open(
      `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      'google-sign-in',
      `width=${width},height=${height},left=${left},top=${top}`
    )
    // The redirect comes back to our origin with the id_token in the hash.
    const check = setInterval(() => {
      try {
        if (!popup || popup.closed) { clearInterval(check); return }
        if (popup.location.origin === location.origin) {
          const hash = popup.location.hash
          popup.close()
          clearInterval(check)
          const fragment = new URLSearchParams(hash.slice(1))
          const idToken = fragment.get('id_token')
          if (idToken) this.#onCredential({ credential: idToken })
        }
      } catch {
        // Cross-origin - still on Google's domain, wait.
      }
    }, 200)
  }

  #loadGsi(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof google !== 'undefined' && google.accounts) { resolve(); return }
      const s = document.createElement('script')
      s.src = 'https://accounts.google.com/gsi/client'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('GSI failed to load'))
      document.head.appendChild(s)
    })
  }
}

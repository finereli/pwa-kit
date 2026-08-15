// The one fetch wrapper for an app's API. Attaches the session token,
// JSON-encodes plain-object bodies (files and streams pass through
// untouched), and funnels 401s into the auth store so a dead session
// re-prompts sign-in instead of leaving the app half-working.
//
//   // src/lib/api.js
//   import { makeApi } from '$shared/lib/api.js'
//   import { auth } from './auth.svelte.js'
//   export const { api, apiJson } = makeApi(auth)
//
// Stores that call these should guard `res.ok` and keep `loading = true` on
// failure (a spinner, not a fake-empty list), and reset their loaded flag on
// auth.onChange so they refetch after re-auth. See reference/behavior.md.

export function makeApi(auth) {
  async function api(path, opts = {}) {
    const headers = { ...opts.headers }
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`
    const isPlainBody = opts.body && typeof opts.body === 'object' &&
      !(opts.body instanceof ReadableStream) &&
      !(opts.body instanceof ArrayBuffer) &&
      !(opts.body instanceof Blob) &&
      !(opts.body instanceof FormData)
    if (isPlainBody) {
      headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(opts.body)
    }
    const res = await fetch(path, { ...opts, headers })
    if (res.status === 401) auth.handleUnauthorized()
    return res
  }

  // api() + res.ok check + parsed JSON, throwing a readable error otherwise.
  async function apiJson(path, opts = {}) {
    const res = await api(path, opts)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `${opts.method || 'GET'} ${path} failed: ${res.status}`)
    }
    return res.json()
  }

  return { api, apiJson }
}

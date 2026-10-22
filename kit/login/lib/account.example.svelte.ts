// pwa-kit: login/lib/account.example.svelte.ts v1
// src/lib/account.svelte.ts in the app: the one login instance, and the
// signed-in user as Svelte state. Call login.handleRedirect() once in main.ts.
import { FinereliLogin, type LoginUser } from '$shared/lib/finereli-login'

export const login = new FinereliLogin({ storageKey: 'myapp.login' })

class Account {
  user = $state<LoginUser | null>(login.user)
  constructor() {
    login.onChange((u) => (this.user = u))
  }
}

export const account = new Account()

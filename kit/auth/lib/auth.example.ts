// pwa-kit: auth/lib/auth.example.ts v7
// src/lib/auth.svelte.ts in the app - the one instance everything imports.
import { GoogleAuth } from '$shared/lib/google-auth.svelte'

export const auth = new GoogleAuth({
  clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  storageKey: 'myapp-user',            // localStorage key for the signed-in user
  devHostSuffix: '.myapp.pages.dev',   // preview deployments; never the production host
})

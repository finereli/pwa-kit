#!/usr/bin/env bash
# Lay the kit out the way a project would: shared/{lib,ui,functions,build,css}, functions/api, src, public
set -e
# In-place sed for both GNU (Linux) and BSD (macOS).
sedi() { if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi; }
cd "$(dirname "$0")"
rm -rf shared functions src public
mkdir -p shared/lib shared/ui shared/functions shared/build shared/css functions/api src/lib public
K=$(cd "$(dirname "$0")/../../kit" && pwd)
for item in $K/*/; do
  [ -d "$item/lib" ] && cp $item/lib/* shared/lib/
  [ -d "$item/ui" ] && cp $item/ui/* shared/ui/
  [ -d "$item/build" ] && cp $item/build/* shared/build/
  [ -d "$item/css" ] && cp $item/css/* shared/css/
  [ -d "$item/public" ] && cp $item/public/* public/
  [ -d "$item/functions" ] && cp $item/functions/*.ts shared/functions/ 2>/dev/null || true
  [ -d "$item/functions/api" ] && cp $item/functions/api/* functions/api/ && sedi "s|../../../shared/|../../shared/|" functions/api/*.ts
  [ -d "$item/src" ] && cp -r $item/src/* src/
done
# examples that a project would place in src/lib
mv shared/lib/auth.example.ts src/lib/auth.svelte.ts
mv shared/lib/account.example.svelte.ts src/lib/account.svelte.ts
sedi "s#YOUR_CLIENT_ID.apps.googleusercontent.com#x.apps.googleusercontent.com#" src/lib/auth.svelte.ts
cat > src/lib/router.svelte.ts <<'R'
import { Router } from '$shared/lib/router.svelte'
type Route = { view: 'home' } | { view: 'about' }
export const router = new Router<Route>({ home: '/', parse(p) { return p === '/about' ? { view: 'about' } : { view: 'home' } } })
R
cat > src/lib/icons.ts <<'R'
export const icons: Record<string, string> = { close: '', install_mobile: '', ios_share: '', more_vert: '' }
R

# InstallBanner imports ./Icon.svelte from ui/ - the icons item's Icon.svelte lives in src/components in a real app; here keep both in shared/ui
sedi "s#from '../lib/icons'#from '../../src/lib/icons'#" shared/ui/Icon.svelte
cat > src/app.css <<'R'
@import '../shared/css/base.css';
R
# smoke file that imports every lib so unused modules still get checked
cat > src/smoke.ts <<'R'
import { makeApi } from '$shared/lib/api'
import { auth } from './lib/auth.svelte'
import { login, account } from './lib/account.svelte'
import { verifyLogin } from '../shared/functions/verify-login'
import { formatDate, formatTime, localDateStr } from '$shared/lib/format'
import { Player } from '$shared/lib/player.svelte'
import { progressFor } from '$shared/lib/progress'
import { UploadQueue, uploadWithProgress } from '$shared/lib/upload'
import { initRemoteLog } from '$shared/lib/remote-log'
import { resizeImage } from '$shared/lib/image-resize'
import { applyAccent, setDarkMode } from '$shared/lib/theme'
import { WsClient } from '$shared/lib/ws-client'
import { SaveTracker } from '$shared/lib/save-tracker.svelte'
import { updates } from '$shared/lib/updates.svelte'
import { makePush } from '$shared/lib/push'
import { pushRoutes } from '../shared/functions/push-routes'
export const { api, apiJson } = makeApi(auth)
export const player = new Player({ audioUrl: (i) => `/m/${i.id}.m4a`, artist: 'x' })
export const q = new UploadQueue({ accept: ['m4a'], async run(job, h) { await uploadWithProgress({ url: '/u', file: job.file }); h.setStep('x') } })
type In = { type: 'auth:ok' } | { type: 'auth:fail' } | { type: 'pong' } | { type: 'text'; seq: number }
type Out = { type: 'auth'; token?: string } | { type: 'ping'; ts: number }
export const ws = new WsClient<In, Out>({ authMessage: () => ({ type: 'auth', token: auth.token }), isAuthOk: (m) => m.type === 'auth:ok', isAuthFail: (m) => m.type === 'auth:fail', isPong: (m) => m.type === 'pong', ping: (ts) => ({ type: 'ping', ts }), onMessage: () => {} })
export const t = new SaveTracker()
export const loginApi = makeApi(login)
export const y = [account, verifyLogin]
export const push = [makePush({ apiJson, storageKey: 'x.push.v1' }), pushRoutes]
export const x = [formatDate('2026-01-01'), formatTime(3), localDateStr(), progressFor('a'), initRemoteLog, resizeImage, applyAccent, setDarkMode, updates]
R
cp $K/shell/vite.config.ts vite.config.ts
sedi "s#'../shared/build/pwa-build'#'./shared/build/pwa-build'#; s#new URL('../shared'#new URL('./shared'#" vite.config.ts
cp $K/shell/index.html index.html
mkdir -p public/icons && for f in icon-192 icon-512 icon-maskable-512 apple-touch-icon; do printf '' > public/icons/$f.png; done
# App.svelte imports Login from $shared/ui - fine; smoke.ts must be imported by main to be bundled
grep -q smoke src/main.ts || sedi "s#import App from './App.svelte'#import App from './App.svelte'\nimport './smoke'#" src/main.ts

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
export const { api, apiJson } = makeApi(auth)
export const player = new Player({ audioUrl: (i) => `/m/${i.id}.m4a`, artist: 'x' })
export const q = new UploadQueue({ accept: ['m4a'], async run(job, h) { await uploadWithProgress({ url: '/u', file: job.file }); h.setStep('x') } })
type In = { type: 'auth:ok' } | { type: 'auth:fail' } | { type: 'pong' } | { type: 'text'; seq: number }
type Out = { type: 'auth'; token?: string } | { type: 'ping'; ts: number }
export const ws = new WsClient<In, Out>({ authMessage: () => ({ type: 'auth', token: auth.token }), isAuthOk: (m) => m.type === 'auth:ok', isAuthFail: (m) => m.type === 'auth:fail', isPong: (m) => m.type === 'pong', ping: (ts) => ({ type: 'ping', ts }), onMessage: () => {} })
export const t = new SaveTracker()
export const loginApi = makeApi(login)
export const y = [account, verifyLogin]
export const x = [formatDate('2026-01-01'), formatTime(3), localDateStr(), progressFor('a'), initRemoteLog, resizeImage, applyAccent, setDarkMode, updates]

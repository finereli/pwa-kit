// pwa-kit: media/lib/progress.ts v3
// Where you got to in each item.
//
// localStorage and anonymous by default. To sync across devices, swap the
// `backend` (setBackend) for one that reads and writes the server and
// everything above it keeps working. That is the whole reason this
// indirection exists. Seams: the storage key (call
// `setBackend(localStorageBackend('myapp.progress.v1'))` once at startup,
// before any playback), DONE_TAIL.

// An item counts as finished once you are within 20 seconds of the end, so a
// recording you sat through to the closing word doesn't sit there at 98%.
const DONE_TAIL = 20

export interface Progress { position: number; completed: boolean; updatedAt?: number }
export type ProgressState = Record<string, Progress>
export interface ProgressBackend { load(): ProgressState; save(state: ProgressState): void }

export function localStorageBackend(key: string): ProgressBackend {
  return {
    load() {
      try {
        return JSON.parse(localStorage.getItem(key) ?? 'null') || {}
      } catch {
        return {}
      }
    },
    save(state) {
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch {
        // Private mode, quota, whatever. Losing a resume position is not fatal.
      }
    },
  }
}

let backend: ProgressBackend = localStorageBackend('app.progress.v1')
let state: ProgressState = backend.load()

export function setBackend(next: ProgressBackend) {
  backend = next
  state = backend.load()
}

export function progressFor(id: string): Progress {
  return state[id] || { position: 0, completed: false }
}

export function recordProgress(id: string, position: number, duration: number) {
  if (!Number.isFinite(position)) return
  const completed = Number.isFinite(duration) && duration > 0 && position >= duration - DONE_TAIL
  state = {
    ...state,
    // Restarting a finished item shouldn't drop it back to "in progress" until
    // you're actually somewhere new in it.
    [id]: { position, completed: completed || (!!state[id]?.completed && position < 5), updatedAt: Date.now() },
  }
  backend.save(state)
}

export function clearProgress(id: string) {
  const next = { ...state }
  delete next[id]
  state = next
  backend.save(state)
}

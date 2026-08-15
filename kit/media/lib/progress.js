// Where you got to in each item.
//
// localStorage and anonymous by default. To sync across devices, swap the
// `backend` (setBackend) for one that reads and writes the server and
// everything above it keeps working. That is the whole reason this
// indirection exists. Seams: KEY (app prefix, versioned), DONE_TAIL.

const KEY = 'app.progress.v1'

// An item counts as finished once you are within 20 seconds of the end, so a
// recording you sat through to the closing word doesn't sit there at 98%.
const DONE_TAIL = 20

const localBackend = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {}
    } catch {
      return {}
    }
  },
  save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // Private mode, quota, whatever. Losing a resume position is not fatal.
    }
  },
}

let backend = localBackend
let state = backend.load()

export function setBackend(next) {
  backend = next
  state = backend.load()
}

export function progressFor(id) {
  return state[id] || { position: 0, completed: false }
}

export function recordProgress(id, position, duration) {
  if (!Number.isFinite(position)) return
  const completed = Number.isFinite(duration) && duration > 0 && position >= duration - DONE_TAIL
  state = {
    ...state,
    // Restarting a finished item shouldn't drop it back to "in progress" until
    // you're actually somewhere new in it.
    [id]: { position, completed: completed || (state[id]?.completed && position < 5), updatedAt: Date.now() },
  }
  backend.save(state)
}

export function clearProgress(id) {
  const next = { ...state }
  delete next[id]
  state = next
  backend.save(state)
}

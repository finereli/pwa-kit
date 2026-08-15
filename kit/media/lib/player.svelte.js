// The playback engine (spec: reference/media.md).
//
// One <audio> element drives everything, including the video items. That is the
// whole trick behind "keeps playing when the screen goes off": browsers stop
// <video> the moment the app is backgrounded, but they keep <audio> running and
// give it lock-screen controls. So for a video item the <video> element is
// muted, carries no audio track at all, and simply follows the audio's clock.
// When the screen comes back on we resync it. Nothing to hand off, nothing to
// race.
//
// The app instantiates it once (src/lib/player.svelte.js):
//
//   export const player = new Player({
//     audioUrl: (item) => `${MEDIA_BASE}/${item.mediaKey}.m4a`,
//     artist: 'Name shown on the lock screen',
//     artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
//     // optional hooks - e.g. a start bell (awaited before play) and an end bell
//     beforePlay: async () => {}, onEnded: () => {}, onLoad: () => {},
//   })
//
// Wire the rest in App.svelte / main.js:
//   document.addEventListener('visibilitychange', () => !document.hidden && player.resync())
//   addEventListener('pagehide', () => player.flush())
//   updates.init({ canReload: () => !player.playing })
// and for video items: <video bind:this={el} muted playsinline {src}> with
// player.attachVideo(el) on mount, detachVideo(el) on unmount.

import { progressFor, recordProgress } from './progress.js'

// Don't resume from the very first moments; you'd rather just start over.
const RESUME_FLOOR = 10
const SAVE_EVERY = 5000

// ── keeping the muted video locked to the audio ──────────────────────────────
//
// Two media elements decode on independent clocks, so they will drift. These are
// talking-head videos, and lip sync goes visibly wrong somewhere around 100ms,
// so "close enough" has to mean close.
//
// Below LOCKED we do nothing. Between LOCKED and HARD we correct by nudging the
// video's playback rate, which is invisible and costs nothing because the video
// carries no audio to pitch-shift. Only a real discontinuity - a buffer stall, a
// seek, coming back from the lock screen - gets a hard seek, because a seek is
// the one correction you can actually see.
const LOCKED = 0.02
const NUDGE = 0.06
const HARD = 0.5
const NUDGE_RATE = 0.04

export class Player {
  item = $state(null)
  queue = $state([])
  playing = $state(false)
  position = $state(0)
  duration = $state(0)
  waiting = $state(false)

  #audio = null
  #video = null
  #raf = 0
  #lastSave = 0
  #seeking = false
  // A resume position waiting for metadata to arrive.
  #pending = null
  // What the user asked for, as distinct from what the element is doing. The
  // two come apart when the browser pauses us behind our back.
  #wanted = false
  #opts

  constructor({ audioUrl, artist = '', album, artwork = [], beforePlay = null, onEnded = null, onLoad = null } = {}) {
    if (!audioUrl) throw new Error('Player: audioUrl(item) is required')
    this.#opts = { audioUrl, artist, album, artwork, beforePlay, onEnded, onLoad }
  }

  get index() {
    return this.item ? this.queue.findIndex((i) => i.id === this.item.id) : -1
  }

  get hasPrev() {
    return this.index > 0
  }

  get hasNext() {
    return this.index >= 0 && this.index < this.queue.length - 1
  }

  #el() {
    if (this.#audio) return this.#audio
    const a = new Audio()
    a.preload = 'metadata'

    // timeupdate only fires about four times a second, which is too coarse for
    // both the scrubber and the sync loop. It is still the backstop for when the
    // tab is hidden and rAF is frozen.
    a.addEventListener('timeupdate', () => this.#tick())
    a.addEventListener('loadedmetadata', () => {
      this.duration = a.duration
      // Assigning currentTime before the element knows the duration is quietly
      // ignored, which would drop the resume position on every cold load. Apply
      // it here, where it sticks.
      if (this.#pending != null) {
        a.currentTime = Math.min(this.#pending, a.duration - 1)
        this.#pending = null
      }
      this.#hardSync()
    })
    a.addEventListener('play', () => {
      this.playing = true
      this.#video?.play().catch(() => {})
      this.#startLoop()
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'
    })
    a.addEventListener('pause', () => {
      this.playing = false
      this.#stopLoop()
      this.#video?.pause()
      this.#save()
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'

      // A pause we didn't ask for, while backgrounded, is the browser suspending
      // us. iOS has done this to standalone PWAs. Ask once to carry on; if the
      // system genuinely meant it the call is refused and we stay paused.
      if (this.#wanted && document.hidden && !a.ended) {
        a.play().catch(() => {})
      }
    })
    // A stall is a discontinuity, so recover from it with a seek rather than
    // asking the rate nudge to claw back a second and a half.
    a.addEventListener('waiting', () => (this.waiting = true))
    a.addEventListener('playing', () => {
      this.waiting = false
      this.#hardSync()
    })
    a.addEventListener('seeked', () => this.#hardSync())
    a.addEventListener('ended', () => {
      this.#wanted = false
      this.playing = false
      this.#stopLoop()
      this.position = this.duration
      this.#save()
      this.#opts.onEnded?.()
    })

    this.#audio = a
    return a
  }

  // ── video follows audio ────────────────────────────────────────────────────

  attachVideo(el) {
    this.#video = el
    if (!el) return
    el.muted = true
    el.playbackRate = 1
    this.#hardSync()
    if (this.playing) {
      el.play().catch(() => {})
      this.#startLoop()
    }
  }

  detachVideo(el) {
    if (this.#video !== el) return
    this.#video = null
    this.#stopLoop()
  }

  #startLoop() {
    if (this.#raf || !this.#video) return
    const step = () => {
      this.#raf = requestAnimationFrame(step)
      this.#tick()
    }
    this.#raf = requestAnimationFrame(step)
  }

  #stopLoop() {
    cancelAnimationFrame(this.#raf)
    this.#raf = 0
    if (this.#video) this.#video.playbackRate = 1
  }

  #tick() {
    const a = this.#audio
    if (!a) return

    if (!this.#seeking) this.position = a.currentTime

    const now = Date.now()
    if (this.playing && now - this.#lastSave > SAVE_EVERY) {
      this.#lastSave = now
      this.#save()
    }

    const v = this.#video
    // While hidden the video is frozen by the browser and its clock is
    // meaningless. Leave it alone; resync() cleans up when we come back.
    if (!v || document.hidden || a.paused || v.readyState < 2) return

    const drift = v.currentTime - a.currentTime
    const mag = Math.abs(drift)

    if (mag > HARD) {
      this.#hardSync()
    } else if (mag > NUDGE) {
      // Video behind means drift is negative, so speed it up.
      v.playbackRate = drift < 0 ? 1 + NUDGE_RATE : 1 - NUDGE_RATE
    } else if (mag < LOCKED && v.playbackRate !== 1) {
      // Hysteresis: only hand back control once we're properly locked, or the
      // rate flaps on and off around the threshold.
      v.playbackRate = 1
    }
  }

  #hardSync() {
    const v = this.#video
    const a = this.#audio
    if (!v || !a || !Number.isFinite(a.currentTime)) return
    try {
      v.playbackRate = 1
      v.currentTime = a.currentTime
    } catch {
      // Not seekable yet. The loop will try again.
    }
  }

  // Coming back to the foreground. Two jobs: the video sat frozen while we were
  // away so it is arbitrarily far behind, and the audio may have been suspended
  // out from under us. Recover both.
  resync() {
    const a = this.#audio
    if (this.#wanted && a?.paused && !a.ended) {
      a.play().catch(() => {})
    }
    this.#hardSync()
    if (this.playing) {
      this.#video?.play().catch(() => {})
      this.#startLoop()
    }
  }

  // ── transport ──────────────────────────────────────────────────────────────

  load(item, queue) {
    if (queue) this.queue = queue
    if (this.item?.id === item.id) return

    const a = this.#el()
    this.#save()
    this.#opts.onLoad?.()

    this.item = item
    this.duration = item.duration || 0
    this.waiting = false

    a.src = this.#opts.audioUrl(item)

    const saved = progressFor(item.id)
    const start = saved.completed ? 0 : saved.position
    this.position = start > RESUME_FLOOR ? start : 0
    // Queued rather than assigned: the element has no duration yet, so it would
    // discard the value. loadedmetadata applies it.
    this.#pending = this.position || null

    this.#announce()
  }

  play() {
    const a = this.#el()
    this.#wanted = true
    // Once the user has committed, pull the audio as fast as the network allows.
    a.preload = 'auto'
    // Only correct the element when it has a duration to validate against;
    // otherwise leave the pending seek to loadedmetadata.
    if (Number.isFinite(a.duration) && Math.abs(a.currentTime - this.position) > 0.5) {
      a.currentTime = this.position
    }
    // A start hook (a bell, say) runs before playback from the top only; a
    // resume goes straight in.
    if (this.#opts.beforePlay && this.position < RESUME_FLOOR) {
      this.waiting = true
      return this.#opts.beforePlay().then(() => {
        this.waiting = false
        if (!this.#wanted) return
        a.play().catch(() => { this.playing = false })
      })
    }
    return a.play().catch(() => {
      this.playing = false
    })
  }

  pause() {
    this.#wanted = false
    this.waiting = false
    this.#audio?.pause()
  }

  toggle() {
    if (this.playing) this.pause()
    else this.play()
  }

  seek(seconds) {
    const a = this.#el()
    const target = Math.max(0, Math.min(seconds, this.duration || seconds))
    this.position = target
    if (Number.isFinite(a.duration)) {
      a.currentTime = target
      this.#hardSync()
    } else {
      this.#pending = target
    }
    this.#save()
  }

  skip(delta) {
    this.seek(this.position + delta)
  }

  // Scrubbing: hold the displayed position steady under the thumb, then commit.
  beginScrub() {
    this.#seeking = true
  }

  scrubTo(seconds) {
    this.position = seconds
  }

  endScrub(seconds) {
    this.#seeking = false
    this.seek(seconds)
  }

  go(offset) {
    const next = this.queue[this.index + offset]
    if (!next) return null
    const wasPlaying = this.playing
    this.load(next, this.queue)
    if (wasPlaying) this.play()
    return next
  }

  prev() {
    // Standard player behaviour: first press restarts, second goes back.
    if (this.position > 5) {
      this.seek(0)
      return null
    }
    return this.go(-1)
  }

  next() {
    return this.go(1)
  }

  #save() {
    if (this.item) recordProgress(this.item.id, this.position, this.duration)
  }

  // ── lock screen ────────────────────────────────────────────────────────────

  #announce() {
    if (!('mediaSession' in navigator) || !this.item) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.item.title,
      artist: this.#opts.artist,
      album: this.item.series || this.#opts.album || this.#opts.artist,
      artwork: this.#opts.artwork,
    })
  }

  init() {
    this.bindMediaSession()
  }

  bindMediaSession() {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const set = (action, handler) => {
      try {
        ms.setActionHandler(action, handler)
      } catch {
        // Older browsers reject actions they don't know.
      }
    }
    set('play', () => this.play())
    set('pause', () => this.pause())
    set('previoustrack', () => this.prev())
    set('nexttrack', () => this.next())
    set('seekbackward', (d) => this.skip(-(d?.seekOffset || 15)))
    set('seekforward', (d) => this.skip(d?.seekOffset || 15))
    set('seekto', (d) => {
      if (d?.seekTime != null) this.seek(d.seekTime)
    })
  }

  flush() {
    this.#save()
  }
}

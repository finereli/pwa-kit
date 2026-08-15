# Audio and media apps

## Audio and media (for media apps)

### Architecture

One `<audio>` element owns everything - lock screen controls, MediaSession, OS play/pause. If the app has video items, encode them as muted mp4s (no audio track) that follow the audio's clock. Browsers kill backgrounded `<video>` but keep `<audio>` alive with lock screen controls.

### MediaSession

Set metadata (title, artist, album, artwork) and handlers for play/pause/previoustrack/nexttrack/seekbackward/seekforward/seekto. Wrap each handler registration in try/catch - old browsers throw on unknown actions. Call `setPositionState()` so the lock screen scrubber shows position.

### The wanted flag

Track user intent separately from element state. On an unexpected pause while `document.hidden` and `wanted === true`, attempt to resume - the OS may have paused it, and a single `play()` call often recovers it.

On `visibilitychange` to visible, call `resync()` to resume if needed and sync video to audio.

### Position persistence

Save playback position every 5000ms while playing, plus on pause/ended/seek, plus `flush()` on `pagehide`. Don't resume from the first 10 seconds (likely just started). Treat "within 20s of the end" as complete. Apply saved position at `loadedmetadata` - setting `currentTime` before duration is known is silently ignored.

Set `preload='metadata'` on create, upgrade to `'auto'` inside `play()`.

### Decorative sounds

Play UI sounds (bells, notifications) through the Web Audio API, never a second `<audio>` element. The main element must keep exclusive ownership of MediaSession.

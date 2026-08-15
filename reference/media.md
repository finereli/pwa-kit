# Audio and media apps

Kit: `media/` (the Player engine, progress persistence). This is a hard one to get right; use the kit.

## Architecture

One `<audio>` element owns everything: lock screen controls, MediaSession, OS play/pause. If the app has video items, encode them as muted mp4s with **no audio track** that follow the audio's clock. Browsers kill backgrounded `<video>` but keep `<audio>` alive with lock screen controls. Nothing to hand off, nothing to race.

Encoding: audio 64k mono AAC, silence-trimmed both ends (ffmpeg `silenceremove` with the reverse trick, -40dB, 0.5s padding); video 720p ~1Mbit h264 without audio, NOT trimmed (tracks must stay in sync). Serve from R2 immutable.

## Keeping the video locked to the audio

Two elements decode on independent clocks and drift; lip sync goes visibly wrong around 100ms. Thresholds: below 0.02s do nothing; 0.06s to 0.5s nudge the video's `playbackRate` ±4% (invisible, and free because the video has no audio to pitch-shift); above 0.5s hard-seek, because a seek is the one correction you can see. Hysteresis when handing back to rate 1. Run the loop on rAF while playing (timeupdate is ~4Hz, too coarse for both the scrubber and the sync); leave the video alone while `document.hidden` (its clock is meaningless) and hard-sync on return.

## MediaSession

Set metadata (title, artist, album, artwork) and handlers for play/pause/previoustrack/nexttrack/seekbackward/seekforward/seekto. Wrap each handler registration in try/catch (old browsers throw on unknown actions). Set `playbackState`.

## The wanted flag

Track user intent separately from element state. On an unexpected `pause` while `document.hidden` and `wanted === true`, call `play()` once: iOS suspends standalone PWAs, and one call often recovers it. On `visibilitychange` to visible call `resync()`: resume if wanted, hard-sync the video.

## Position persistence

Save every 5s while playing, plus on pause/ended/seek, plus `flush()` on `pagehide`. Don't resume from the first 10s (they'd rather start over). Within 20s of the end counts as complete. Apply the saved position at `loadedmetadata`: setting `currentTime` before the duration is known is silently ignored, which drops the resume on every cold load. `preload='metadata'` on create, `'auto'` inside `play()`.

Persistence is behind a `backend` seam: localStorage by default, swap for the server to sync across devices.

## Autoplay and gestures

Any programmatic `play()` later (TTS, a queued next item) needs a warm-up on a real user gesture first: play a silent WAV data-URI and set MediaSession metadata. Android also keeps audio alive when backgrounded only after that.

## Decorative sounds

Play UI sounds (bells) through the Web Audio API, never a second `<audio>` element. The main element must keep exclusive ownership of MediaSession. Hooks on the Player (`beforePlay`, `onEnded`) are where a start/end bell goes.

## Transport conventions

Prev: first press restarts if past 5s, second goes back. Skip ±15s. `replaceItem` (history.replaceState) when moving through a queue so five skips don't leave five history entries. Scrubbing holds the displayed position under the thumb and commits on release. Progress bars are LTR even in RTL apps; timecodes use `tabular-nums`.

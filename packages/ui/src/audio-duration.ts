/**
 * Repairs the duration of a WebM recorded by `MediaRecorder`.
 *
 * MediaRecorder started with a timeslice (`recorder.start(100)`) muxes a *streaming*
 * WebM: the header carries no Duration and no Cues. Browsers then report
 * `audio.duration === Infinity`, which renders the native player with no total time
 * and a dead seek bar — it looks disabled. The longer the clip, the more it hurts,
 * because seeking is impossible.
 *
 * New recordings avoid this by calling `recorder.start()` with no timeslice, but clips
 * already on disk keep the broken header. Seeking far past the end forces the browser
 * to scan the file and work the real duration out, after which the player behaves.
 *
 * Attach on `loadedmetadata`:
 *   <audio onLoadedMetadata={(e) => repairInfiniteDuration(e.currentTarget)} />
 */
export function repairInfiniteDuration(el: HTMLAudioElement): void {
  // Finite already (an mp3/wav upload, or a recording made after the start() fix).
  if (el.duration !== Infinity) return;
  // Only safe while parked at the start — seeking a playing element would jump the audio.
  if (!el.paused || el.currentTime > 0) return;

  const onTimeUpdate = () => {
    el.removeEventListener("timeupdate", onTimeUpdate);
    // `duration` is now finite; put the playhead back where the listener expects it.
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  };
  el.addEventListener("timeupdate", onTimeUpdate);
  try {
    // Any absurdly large offset works; the browser clamps to the real end.
    el.currentTime = 1e101;
  } catch {
    el.removeEventListener("timeupdate", onTimeUpdate);
  }
}

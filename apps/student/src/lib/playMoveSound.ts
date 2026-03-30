import moveSoundUrl from "../assets/sounds/move.mp3";

let audio: HTMLAudioElement | null = null;

/** Plays the variant move sound (practice / repeat / autoplay). Safe to call rapidly. */
export function playMoveSound(): void {
  try {
    if (typeof window === "undefined") return;
    if (!audio) {
      audio = new Audio(moveSoundUrl);
      audio.volume = 0.45;
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* autoplay policy / missing file */
    });
  } catch {
    /* ignore */
  }
}

import achievementUrl from "../assets/sounds/achievement.mp3";
import failUrl from "../assets/sounds/fail.mp3";
import gameStartUrl from "../assets/sounds/game-start.mp3";
import moveSoundUrl from "../assets/sounds/move.mp3";

let moveAudio: HTMLAudioElement | null = null;

function playOneShot(url: string, volume: number): void {
  try {
    if (typeof window === "undefined") return;
    const a = new Audio(url);
    a.volume = volume;
    void a.play().catch(() => {
      /* autoplay policy / missing file */
    });
  } catch {
    /* ignore */
  }
}

/** Plays the variant move sound (practice / repeat / autoplay). Safe to call rapidly. */
export function playMoveSound(): void {
  try {
    if (typeof window === "undefined") return;
    if (!moveAudio) {
      moveAudio = new Audio(moveSoundUrl);
      moveAudio.volume = 0.45;
    }
    moveAudio.currentTime = 0;
    void moveAudio.play().catch(() => {
      /* autoplay policy / missing file */
    });
  } catch {
    /* ignore */
  }
}

/** Wrong move in mashq or takrorlash (shake / reset). */
export function playFailSound(): void {
  playOneShot(failUrl, 0.48);
}

/** Line completed successfully in mashq or takrorlash. */
export function playAchievementSound(): void {
  playOneShot(achievementUrl, 0.52);
}

/** User started mashq, takrorlash, or o‘rganish. */
export function playGameStartSound(): void {
  playOneShot(gameStartUrl, 0.42);
}

let beepCtx: AudioContext | null = null;

function getBeepCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!beepCtx) beepCtx = new Ctx();
    if (beepCtx.state === "suspended") void beepCtx.resume().catch(() => undefined);
    return beepCtx;
  } catch {
    return null;
  }
}

/**
 * Short countdown beep synthesised via Web Audio (no asset needed).
 * `urgent` raises pitch/volume for the final seconds.
 */
export function playCountdownBeep(urgent = false): void {
  try {
    const ctx = getBeepCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = urgent ? 950 : 700;
    const peak = urgent ? 0.3 : 0.2;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    /* ignore */
  }
}

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

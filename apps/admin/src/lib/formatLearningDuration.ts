/** Format total seconds for admin UI (Uzbek labels). */
export function formatLearningDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r > 0 ? `${m} daq ${r}s` : `${m} daq`;
  const h = Math.floor(m / 60);
  const m2 = m % 60;
  return m2 > 0 ? `${h} soat ${m2} daq` : `${h} soat`;
}

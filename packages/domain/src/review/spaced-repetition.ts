export function calculateNextInterval(previousDays: number, score: number): number {
  if (score >= 90) return Math.max(1, previousDays * 2);
  if (score >= 70) return Math.max(1, Math.round(previousDays * 1.5));
  return 1;
}

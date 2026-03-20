export function calculateMasteryFromScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function nextReviewDays(mastery: number): number {
  if (mastery >= 90) return 7;
  if (mastery >= 70) return 3;
  if (mastery >= 40) return 1;
  return 0;
}

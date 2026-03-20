export function normalizeDifficulty(text: string): "easy" | "normal" | "hard" {
  if (text.length < 20) return "easy";
  if (text.length < 60) return "normal";
  return "hard";
}

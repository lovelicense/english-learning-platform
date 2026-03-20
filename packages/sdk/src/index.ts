import type { GenerateExpressionRequest, GenerateExpressionResponse, PracticeScoreRequest, PracticeScoreResponse, ReviewItem } from "@elp/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function generateExpression(payload: GenerateExpressionRequest): Promise<GenerateExpressionResponse> {
  const res = await fetch(`${API_URL}/expressions/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  return res.json();
}

export async function scorePractice(payload: PracticeScoreRequest): Promise<PracticeScoreResponse> {
  const res = await fetch(`${API_URL}/practice/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  return res.json();
}

export async function getTodayReviews(): Promise<ReviewItem[]> {
  const res = await fetch(`${API_URL}/reviews/today`, { cache: "no-store" });
  return res.json();
}

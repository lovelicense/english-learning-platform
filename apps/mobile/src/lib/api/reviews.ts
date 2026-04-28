import { apiFetch } from "./client";

export type ReviewItemResponse = {
  id: string;
  korean: string;
  english: string;
  mastery: number;
  ttsKey?: string | null;
  recommendedTestType: "translation" | "situation" | "think";
  reviewReason: string;
  lastReviewedAt?: string | null;
  practiceAnswer?: string | null;
  practiceAudioUrl?: string | null;
};

export async function listTodayReviews(strategy?: "system" | "low_score" | "stale" | "voice_gap" | "random") {
  const query = strategy ? `?strategy=${strategy}` : "";
  return apiFetch<ReviewItemResponse[]>(`/reviews/today${query}`);
}

import { apiFetch } from "./client";

export type PracticePromptResponse = {
  testType: "translation" | "situation" | "pattern" | "think";
  promptKorean: string;
  promptContext?: string;
  tips?: string;
  target: string;
  targetAlt?: string;
  referenceTarget?: string;
  patternLabel?: string;
  patternDescription?: string;
};

export type PracticeScoreResponse = {
  id: string;
  score: number;
  meaningScore: number;
  naturalnessScore: number;
  grammarScore: number;
  feedback: string;
  strengthComment: string;
  correctionComment: string;
  meaningComment?: string | null;
  suggestedAnswer: string;
  suggestedAnswerAlt?: string;
  target: string;
  answer: string;
  recognizedAnswer?: string | null;
  audioUrl?: string | null;
};

export type PracticeVoicePresignResponse = {
  key: string;
  uploadUrl: string;
};

export type PracticeHistoryResponse = {
  id: string;
  expressionId: string;
  koreanText: string;
  englishBase: string;
  answer: string;
  recognizedAnswer?: string | null;
  target: string;
  mode: "text" | "voice";
  testType: "translation" | "situation" | "pattern" | "think";
  promptKorean?: string | null;
  promptContext?: string | null;
  score: number;
  meaningScore?: number | null;
  naturalnessScore?: number | null;
  grammarScore?: number | null;
  feedback?: string | null;
  strengthComment?: string | null;
  correctionComment?: string | null;
  meaningComment?: string | null;
  suggestedAnswer?: string | null;
  suggestedAnswerAlt?: string | null;
  createdAt: string;
  audioUrl?: string | null;
};

export async function generatePracticePrompt(
  expressionId: string,
  testType: "translation" | "situation" | "pattern" | "think",
) {
  return apiFetch<PracticePromptResponse>("/practice/prompts", {
    method: "POST",
    body: JSON.stringify({
      expressionId,
      testType,
    }),
  });
}

export async function scorePracticeAnswer(input: {
  expressionId: string;
  answer: string;
  testType: "translation" | "situation" | "pattern" | "think";
  promptKorean?: string;
  promptContext?: string;
  promptTarget?: string;
  promptTargetAlt?: string;
  promptReferenceTarget?: string;
  promptPatternLabel?: string;
  promptPatternDescription?: string;
}) {
  return apiFetch<PracticeScoreResponse>("/practice/score", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createPracticeVoicePresign(input: {
  fileName: string;
  contentType: string;
}) {
  return apiFetch<PracticeVoicePresignResponse>("/practice/voice/presign", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function scorePracticeVoiceAnswer(input: {
  expressionId: string;
  audioKey: string;
  fileName: string;
  testType: "translation" | "situation" | "pattern" | "think";
  promptKorean?: string;
  promptContext?: string;
  promptTarget?: string;
  promptTargetAlt?: string;
  promptReferenceTarget?: string;
  promptPatternLabel?: string;
  promptPatternDescription?: string;
}) {
  return apiFetch<PracticeScoreResponse>("/practice/score-voice", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listPracticeLogs(limit = 20) {
  return apiFetch<PracticeHistoryResponse[]>(`/practice/logs?limit=${limit}`);
}

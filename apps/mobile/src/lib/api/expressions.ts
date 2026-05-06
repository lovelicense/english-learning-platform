import { apiFetch } from "./client";

export type ExpressionResponse = {
  id: string;
  utteranceId?: string | null;
  savedSentenceId?: string | null;
  koreanText: string;
  englishBase: string;
  englishEasy: string;
  englishNatural: string;
  thinkInEnglish?: string | null;
  note?: string | null;
  userMemo?: string | null;
  ttsKey?: string | null;
  ttsUrl?: string | null;
  koreanTtsKey?: string | null;
  koreanTtsUrl?: string | null;
  sourceAnalysisIntent?: string | null;
  sourceAnalysisSummary?: string | null;
  sourceRelationship?: string | null;
  sourceSituation?: string | null;
  sourceTone?: string | null;
  sourceContextNote?: string | null;
  practiceCount?: number;
  latestPracticeScore?: number | null;
  createdAt?: string;
};

export type ExpressionTtsResponse = {
  expressionId: string;
  ttsKey: string;
  ttsUrl: string;
  koreanTtsKey: string;
  koreanTtsUrl: string;
  expression: string;
};

export type BulkExpressionResponse = {
  recordingId: string;
  createdCount: number;
  skippedCount: number;
  totalRequested: number;
  expressions: ExpressionResponse[];
};

export type BulkTtsResponse = {
  recordingId: string;
  updatedCount: number;
  skippedCount: number;
  totalRequested: number;
  expressions: ExpressionTtsResponse[];
};

export type SavePracticeExpressionInput = {
  koreanText: string;
  englishBase: string;
  englishEasy?: string;
  englishNatural?: string;
  promptContext?: string;
  note?: string;
};

export async function listExpressions() {
  return apiFetch<ExpressionResponse[]>("/expressions");
}

export async function generateExpressionForUtterance(
  utteranceId: string,
  input?: {
    relationship?: string;
    situation?: string;
    tone?: string;
  },
) {
  return apiFetch<ExpressionResponse>("/expressions/generate", {
    method: "POST",
    body: JSON.stringify({
      utteranceId,
      relationship: input?.relationship,
      situation: input?.situation,
      tone: input?.tone,
    }),
  });
}

export async function generateExpressionFromText(input: {
  koreanText: string;
  personProfileIds?: string[];
  relationship?: string;
  situation?: string;
  tone?: string;
}) {
  return apiFetch<ExpressionResponse>("/expressions/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function generateExpressionTts(expressionId: string) {
  return apiFetch<ExpressionTtsResponse>(`/expressions/${expressionId}/tts`, {
    method: "POST",
  });
}

export async function generateRecordingExpressionsBulk(input: {
  recordingId: string;
  speakerScope?: "mine" | "others" | "all";
  includeExisting?: boolean;
  relationship?: string;
  situation?: string;
  tone?: string;
}) {
  return apiFetch<BulkExpressionResponse>("/expressions/generate/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function generateRecordingTtsBulk(input: {
  recordingId: string;
  onlyMissing?: boolean;
}) {
  return apiFetch<BulkTtsResponse>("/expressions/tts/bulk", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateExpressionMemo(expressionId: string, userMemo?: string) {
  return apiFetch<ExpressionResponse>(`/expressions/${expressionId}/memo`, {
    method: "PATCH",
    body: JSON.stringify({
      userMemo,
    }),
  });
}

export async function savePracticeExpression(input: SavePracticeExpressionInput) {
  return apiFetch<ExpressionResponse>("/expressions/save-practice", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

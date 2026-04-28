import { apiFetch } from "./client";

export type RecordingUtteranceResponse = {
  id: string;
  speakerLabel: string;
  koreanText: string;
  startMs: number;
  endMs: number;
  isMine: boolean;
  contextNote?: string | null;
  analysisIntent?: string | null;
};

export type RecordingResponse = {
  id: string;
  fileName: string;
  status: string;
  diarization: boolean;
  createdAt: string;
  updatedAt: string;
  analysisSummary?: string | null;
  analysisRelationship?: string | null;
  analysisSituation?: string | null;
  analysisTone?: string | null;
  analysisStatus?: "NOT_ANALYZED" | "OK" | "NEEDS_REVIEW" | null;
  analysisStatusReason?: string | null;
  audioUrl: string;
  utterances: RecordingUtteranceResponse[];
};

export async function fetchRecording(recordingId: string) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}`);
}

export async function updateRecordingUtterance(
  utteranceId: string,
  input: {
    koreanText?: string;
    speakerLabel?: string;
    contextNote?: string;
    markAnalysisReview?: boolean;
  },
) {
  return apiFetch<RecordingUtteranceResponse>(`/recordings/utterances/${utteranceId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteRecordingUtterance(utteranceId: string, markAnalysisReview = true) {
  return apiFetch<{
    success: boolean;
    utteranceId: string;
    deletedExpressionCount: number;
  }>(`/recordings/utterances/${utteranceId}`, {
    method: "DELETE",
    body: JSON.stringify({
      markAnalysisReview,
    }),
  });
}

export async function updateRecordingMineSpeaker(recordingId: string, speakerLabel: string) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}/mine-speaker`, {
    method: "PATCH",
    body: JSON.stringify({
      speakerLabel,
    }),
  });
}

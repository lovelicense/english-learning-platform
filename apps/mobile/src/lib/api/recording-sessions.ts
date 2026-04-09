import { apiFetch } from "./client";

export type RecordingSessionCreateResponse = {
  sessionId: string;
  status: string;
  recommendedPartDurationMs: number;
  maxDurationMs: number;
};

export type RecordingSessionStatusResponse = {
  id: string;
  status: string;
  source: string;
  title: string | null;
  uploadedPartCount: number;
  expectedPartCount: number | null;
  totalDurationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  parts: Array<{
    id: string;
    partNumber: number;
    status: string;
    fileName: string;
    durationMs: number | null;
    sizeBytes: number | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export async function createRecordingSession(title?: string) {
  return apiFetch<RecordingSessionCreateResponse>("/recording-sessions", {
    method: "POST",
    body: JSON.stringify({
      source: "MOBILE",
      title: title?.trim() || undefined,
    }),
  });
}

export async function fetchRecordingSession(sessionId: string) {
  return apiFetch<RecordingSessionStatusResponse>(`/recording-sessions/${sessionId}`);
}

export async function finalizeRecordingSession(sessionId: string, expectedPartCount?: number, totalDurationMs?: number) {
  return apiFetch<{
    sessionId: string;
    status: string;
    expectedPartCount: number | null;
    uploadedPartCount: number;
    totalDurationMs: number | null;
  }>(`/recording-sessions/${sessionId}/finalize`, {
    method: "POST",
    body: JSON.stringify({
      expectedPartCount,
      totalDurationMs,
    }),
  });
}

export async function enqueueRecordingSessionProcessing(sessionId: string, diarization = true) {
  return apiFetch<{
    sessionId: string;
    status: string;
    queuedJobCount: number;
  }>(`/recording-sessions/${sessionId}/process`, {
    method: "POST",
    body: JSON.stringify({
      diarization,
    }),
  });
}

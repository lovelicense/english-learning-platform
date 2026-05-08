import { apiFetch } from "./client";

export type RecordingSessionSource = "MOBILE" | "MANUAL_UPLOAD";

export type RecordingSessionCreateResponse = {
  sessionId: string;
  status: string;
  recommendedPartDurationMs: number;
  maxDurationMs: number;
};

export type RecordingSessionPartPresignResponse = {
  sessionId: string;
  partId: string;
  partNumber: number;
  audioKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
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

export async function createRecordingSession(input?: {
  title?: string;
  source?: RecordingSessionSource;
}) {
  return apiFetch<RecordingSessionCreateResponse>("/recording-sessions", {
    method: "POST",
    body: JSON.stringify({
      source: input?.source ?? "MOBILE",
      title: input?.title?.trim() || undefined,
    }),
  });
}

export async function fetchRecordingSession(sessionId: string) {
  return apiFetch<RecordingSessionStatusResponse>(`/recording-sessions/${sessionId}`);
}

export async function createRecordingSessionPartPresign(
  sessionId: string,
  input: {
    partNumber: number;
    fileName: string;
    contentType?: string;
    sizeBytes?: number;
  },
) {
  return apiFetch<RecordingSessionPartPresignResponse>(`/recording-sessions/${sessionId}/parts/presign`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function completeRecordingSessionPart(
  sessionId: string,
  partId: string,
  input: {
    durationMs?: number;
    sizeBytes?: number;
  },
) {
  return apiFetch<{
    sessionId: string;
    partId: string;
    recordingId: string;
    status: string;
    uploadedPartCount: number;
  }>(`/recording-sessions/${sessionId}/parts/${partId}/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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

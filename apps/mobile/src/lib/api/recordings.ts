import { apiFetch } from "./client";

export type RecordingSummaryResponse = {
  id: string;
  fileName: string;
  status: string;
  diarization: boolean;
  createdAt: string;
  updatedAt: string;
  analysisStatus?: "NOT_ANALYZED" | "OK" | "NEEDS_REVIEW" | null;
  analysisStatusReason?: string | null;
  _count: {
    utterances: number;
  };
};

export type PersonProfileResponse = {
  id: string;
  name: string;
  roleLabel?: string | null;
  relationshipToMe?: string | null;
  aliases?: string | null;
  notes?: string | null;
  isMe?: boolean;
};

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
  analysisUpdatedAt?: string | null;
  audioUrl: string;
  participants: Array<{ personProfile: PersonProfileResponse }>;
  speakerProfiles: Array<{
    speakerLabel: string;
    personProfileId: string;
    personProfile: PersonProfileResponse;
  }>;
  utterances: RecordingUtteranceResponse[];
};

export type RecordingAnalysisResponse = {
  summary: string;
  intents: Array<{
    utteranceId?: string;
    speakerLabel?: string;
    koreanText: string;
    intent: string;
  }>;
};

export async function listRecordings() {
  return apiFetch<RecordingSummaryResponse[]>("/recordings");
}

export async function fetchRecording(recordingId: string) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}`);
}

export async function reprocessRecording(recordingId: string, diarization = true) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}/process`, {
    method: "POST",
    body: JSON.stringify({
      diarization,
    }),
  });
}

export async function deleteRecording(recordingId: string) {
  return apiFetch<{ success: boolean; recordingId: string }>(`/recordings/${recordingId}`, {
    method: "DELETE",
  });
}

export async function analyzeRecording(
  recordingId: string,
  input: {
    relationship?: string;
    situation?: string;
    tone?: string;
  },
) {
  return apiFetch<RecordingAnalysisResponse>(`/recordings/${recordingId}/analyze`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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

export async function updateRecordingSpeakerLabel(
  recordingId: string,
  speakerLabel: string,
  nextSpeakerLabel: string,
) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}/speaker-label`, {
    method: "PATCH",
    body: JSON.stringify({
      speakerLabel,
      nextSpeakerLabel,
    }),
  });
}

export async function updateRecordingAnalysisStatus(
  recordingId: string,
  status: "OK" | "NEEDS_REVIEW",
  reason?: string,
) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}/analysis-status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      reason,
    }),
  });
}

export async function updateRecordingParticipants(recordingId: string, personProfileIds: string[]) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}/participants`, {
    method: "PATCH",
    body: JSON.stringify({
      personProfileIds,
    }),
  });
}

export async function updateRecordingSpeakerProfile(
  recordingId: string,
  speakerLabel: string,
  personProfileId?: string,
) {
  return apiFetch<RecordingResponse>(`/recordings/${recordingId}/speaker-profile`, {
    method: "PATCH",
    body: JSON.stringify({
      speakerLabel,
      ...(personProfileId ? { personProfileId } : {}),
    }),
  });
}

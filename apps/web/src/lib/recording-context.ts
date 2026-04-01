"use client";

export type RecordingGenerationContext = {
  relationship: string;
  situation: string;
  tone: string;
};

const STORAGE_PREFIX = "elp_recording_context:";

export const EMPTY_RECORDING_CONTEXT: RecordingGenerationContext = {
  relationship: "",
  situation: "",
  tone: "",
};

export function loadRecordingContext(recordingId: string): RecordingGenerationContext {
  if (typeof window === "undefined") return EMPTY_RECORDING_CONTEXT;
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${recordingId}`);
  if (!raw) return EMPTY_RECORDING_CONTEXT;

  try {
    const parsed = JSON.parse(raw) as Partial<RecordingGenerationContext>;
    return {
      relationship: parsed.relationship ?? "",
      situation: parsed.situation ?? "",
      tone: parsed.tone ?? "",
    };
  } catch {
    return EMPTY_RECORDING_CONTEXT;
  }
}

export function saveRecordingContext(recordingId: string, context: RecordingGenerationContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${recordingId}`, JSON.stringify(context));
}

export function buildRecordingContextPayload(context: RecordingGenerationContext) {
  const relationship = context.relationship.trim();
  const situation = context.situation.trim();
  const tone = context.tone.trim();

  return {
    ...(relationship ? { relationship } : {}),
    ...(situation ? { situation } : {}),
    ...(tone ? { tone } : {}),
  };
}

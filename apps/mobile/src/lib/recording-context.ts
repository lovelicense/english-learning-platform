import { getStorageItem, setStorageItem } from "./storage";

export type RecordingGenerationContext = {
  relationship: string;
  situation: string;
  tone: string;
};

const STORAGE_PREFIX = "elp_mobile_recording_context:";
const RECENT_CONTEXT_KEY = "elp_mobile_recent_generation_context";

export const RELATIONSHIP_TEMPLATES = [
  "엄마 - 아이",
  "아빠 - 아이",
  "부부",
  "친구",
  "손님 - 직원",
  "부모 - 자녀",
  "선생님 - 학생",
] as const;

export const SITUATION_TEMPLATES = [
  "집",
  "이동 중",
  "식사 중",
  "가족 식사",
  "병원",
  "학교",
  "가게",
  "통화 중",
] as const;

export const TONE_TEMPLATES = ["자연스럽게", "부드럽게", "단호하게", "친근하게", "공손하게"] as const;

export const EMPTY_RECORDING_CONTEXT: RecordingGenerationContext = {
  relationship: "",
  situation: "",
  tone: "",
};

function normalizeContext(raw: string | null) {
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

export async function getRecordingContext(recordingId: string) {
  return normalizeContext(await getStorageItem(`${STORAGE_PREFIX}${recordingId}`));
}

export async function setRecordingContext(recordingId: string, context: RecordingGenerationContext) {
  await setStorageItem(`${STORAGE_PREFIX}${recordingId}`, JSON.stringify(context));
  return context;
}

export async function getRecentGenerationContext() {
  return normalizeContext(await getStorageItem(RECENT_CONTEXT_KEY));
}

export async function setRecentGenerationContext(context: RecordingGenerationContext) {
  await setStorageItem(RECENT_CONTEXT_KEY, JSON.stringify(context));
  return context;
}

export function hasRecordingContextValue(context: RecordingGenerationContext) {
  return Boolean(context.relationship.trim() || context.situation.trim() || context.tone.trim());
}

export function contextsEqual(left: RecordingGenerationContext, right: RecordingGenerationContext) {
  return (
    left.relationship === right.relationship &&
    left.situation === right.situation &&
    left.tone === right.tone
  );
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

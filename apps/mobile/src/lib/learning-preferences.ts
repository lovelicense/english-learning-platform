import { getStorageItem, setStorageItem } from "./storage";

const LEARNING_PREFERENCES_KEY = "elp_mobile_learning_preferences";

export type LearningAnswerMode = "voice" | "text";

export type LearningPreferences = {
  defaultAnswerMode: LearningAnswerMode;
  autoPlayPromptTts: boolean;
  autoStartVoiceRecording: boolean;
};

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  defaultAnswerMode: "voice",
  autoPlayPromptTts: true,
  autoStartVoiceRecording: true,
};

export async function getLearningPreferences(): Promise<LearningPreferences> {
  const raw = await getStorageItem(LEARNING_PREFERENCES_KEY);
  if (!raw) {
    return DEFAULT_LEARNING_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LearningPreferences>;
    return {
      defaultAnswerMode:
        parsed.defaultAnswerMode === "text" || parsed.defaultAnswerMode === "voice"
          ? parsed.defaultAnswerMode
          : DEFAULT_LEARNING_PREFERENCES.defaultAnswerMode,
      autoPlayPromptTts:
        typeof parsed.autoPlayPromptTts === "boolean"
          ? parsed.autoPlayPromptTts
          : DEFAULT_LEARNING_PREFERENCES.autoPlayPromptTts,
      autoStartVoiceRecording:
        typeof parsed.autoStartVoiceRecording === "boolean"
          ? parsed.autoStartVoiceRecording
          : DEFAULT_LEARNING_PREFERENCES.autoStartVoiceRecording,
    };
  } catch {
    return DEFAULT_LEARNING_PREFERENCES;
  }
}

export async function setLearningPreferences(next: LearningPreferences) {
  const normalized: LearningPreferences = {
    defaultAnswerMode: next.defaultAnswerMode,
    autoPlayPromptTts: next.autoPlayPromptTts,
    autoStartVoiceRecording: next.autoStartVoiceRecording,
  };
  await setStorageItem(LEARNING_PREFERENCES_KEY, JSON.stringify(normalized));
  return normalized;
}

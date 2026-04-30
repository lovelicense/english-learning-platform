import { getStorageItem, setStorageItem } from "./storage";

const RECORDING_PREFERENCES_KEY = "elp_mobile_recording_preferences";

export type RecordingPreferences = {
  defaultSessionTitle: string;
  autoUploadAfterStop: boolean;
  openResultAfterUpload: boolean;
};

export const DEFAULT_RECORDING_PREFERENCES: RecordingPreferences = {
  defaultSessionTitle: "",
  autoUploadAfterStop: false,
  openResultAfterUpload: true,
};

export async function getRecordingPreferences(): Promise<RecordingPreferences> {
  const raw = await getStorageItem(RECORDING_PREFERENCES_KEY);
  if (!raw) {
    return DEFAULT_RECORDING_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RecordingPreferences>;
    return {
      defaultSessionTitle: typeof parsed.defaultSessionTitle === "string" ? parsed.defaultSessionTitle : DEFAULT_RECORDING_PREFERENCES.defaultSessionTitle,
      autoUploadAfterStop:
        typeof parsed.autoUploadAfterStop === "boolean" ? parsed.autoUploadAfterStop : DEFAULT_RECORDING_PREFERENCES.autoUploadAfterStop,
      openResultAfterUpload:
        typeof parsed.openResultAfterUpload === "boolean" ? parsed.openResultAfterUpload : DEFAULT_RECORDING_PREFERENCES.openResultAfterUpload,
    };
  } catch {
    return DEFAULT_RECORDING_PREFERENCES;
  }
}

export async function setRecordingPreferences(next: RecordingPreferences) {
  const normalized: RecordingPreferences = {
    defaultSessionTitle: next.defaultSessionTitle.trim(),
    autoUploadAfterStop: next.autoUploadAfterStop,
    openResultAfterUpload: next.openResultAfterUpload,
  };
  await setStorageItem(RECORDING_PREFERENCES_KEY, JSON.stringify(normalized));
  return normalized;
}

import { getStorageItem, setStorageItem } from "./storage";

const RECORDING_ANALYSIS_MODE_KEY = "elp_mobile_recording_analysis_mode";

export type RecordingAnalysisMode = "manual" | "auto";

export const DEFAULT_RECORDING_ANALYSIS_MODE: RecordingAnalysisMode = "manual";

export async function getRecordingAnalysisMode(): Promise<RecordingAnalysisMode> {
  const raw = await getStorageItem(RECORDING_ANALYSIS_MODE_KEY);
  return raw === "auto" || raw === "manual" ? raw : DEFAULT_RECORDING_ANALYSIS_MODE;
}

export async function setRecordingAnalysisMode(mode: RecordingAnalysisMode) {
  await setStorageItem(RECORDING_ANALYSIS_MODE_KEY, mode);
  return mode;
}

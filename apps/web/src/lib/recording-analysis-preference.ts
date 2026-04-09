"use client";

export type RecordingAnalysisMode = "manual" | "auto";

const RECORDING_ANALYSIS_MODE_KEY = "elp_recording_analysis_mode";

export const DEFAULT_RECORDING_ANALYSIS_MODE: RecordingAnalysisMode = "manual";

export function loadRecordingAnalysisMode(): RecordingAnalysisMode {
  if (typeof window === "undefined") return DEFAULT_RECORDING_ANALYSIS_MODE;
  const raw = window.localStorage.getItem(RECORDING_ANALYSIS_MODE_KEY);
  return raw === "auto" ? "auto" : DEFAULT_RECORDING_ANALYSIS_MODE;
}

export function saveRecordingAnalysisMode(mode: RecordingAnalysisMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECORDING_ANALYSIS_MODE_KEY, mode);
}

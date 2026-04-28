import { Platform } from "react-native";

export const MOBILE_APP_NAME = "English Learning Mobile";

function resolveDefaultApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  if (Platform.OS === "ios" || Platform.OS === "web") {
    return "http://localhost:4000";
  }

  return "https://api.chunsay.com";
}

export const API_BASE_URL = resolveDefaultApiBaseUrl();
export const API_BASE_URL_SOURCE = process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
  ? "env"
  : Platform.OS === "android"
    ? "android-emulator-default"
    : Platform.OS === "ios" || Platform.OS === "web"
      ? "localhost-default"
      : "production-fallback";

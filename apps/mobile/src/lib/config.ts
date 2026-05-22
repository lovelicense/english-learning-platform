import { Platform } from "react-native";
import { deleteStorageItem, getStorageItem, setStorageItem } from "./storage";

export const MOBILE_APP_NAME = "English Learning Mobile";

const API_BASE_URL_KEY = "elp_mobile_api_base_url";

type ApiBaseUrlSource = "stored" | "env" | "android-emulator-default" | "localhost-default" | "production-fallback";

export type ApiBaseUrlInfo = {
  value: string;
  source: ApiBaseUrlSource;
  defaultValue: string;
};

let cachedApiBaseUrl: string | null | undefined;

function resolveDefaultApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:4000";
    }

    if (Platform.OS === "ios" || Platform.OS === "web") {
      return "http://localhost:4000";
    }
  }

  return "https://api.chunsay.com";
}

function resolveDefaultApiBaseUrlSource(): ApiBaseUrlSource {
  return process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
    ? "env"
    : __DEV__
      ? Platform.OS === "android"
        ? "android-emulator-default"
        : Platform.OS === "ios" || Platform.OS === "web"
          ? "localhost-default"
          : "production-fallback"
      : "production-fallback";
}

function normalizeApiBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export const DEFAULT_API_BASE_URL = resolveDefaultApiBaseUrl();
export const DEFAULT_API_BASE_URL_SOURCE = resolveDefaultApiBaseUrlSource();

export async function getApiBaseUrl() {
  if (cachedApiBaseUrl !== undefined) {
    return cachedApiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  const stored = await getStorageItem(API_BASE_URL_KEY);
  cachedApiBaseUrl = stored ? normalizeApiBaseUrl(stored) : null;
  return cachedApiBaseUrl ?? DEFAULT_API_BASE_URL;
}

export async function getApiBaseUrlInfo(): Promise<ApiBaseUrlInfo> {
  const stored = await getStorageItem(API_BASE_URL_KEY);
  const normalizedStored = stored ? normalizeApiBaseUrl(stored) : "";

  if (normalizedStored) {
    cachedApiBaseUrl = normalizedStored;
    return {
      value: normalizedStored,
      source: "stored",
      defaultValue: DEFAULT_API_BASE_URL,
    };
  }

  cachedApiBaseUrl = null;
  return {
    value: DEFAULT_API_BASE_URL,
    source: DEFAULT_API_BASE_URL_SOURCE,
    defaultValue: DEFAULT_API_BASE_URL,
  };
}

export async function setApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("API 주소는 http:// 또는 https:// 로 시작해야 합니다.");
  }

  await setStorageItem(API_BASE_URL_KEY, normalized);
  cachedApiBaseUrl = normalized;
  return normalized;
}

export async function resetApiBaseUrl() {
  await deleteStorageItem(API_BASE_URL_KEY);
  cachedApiBaseUrl = null;
  return DEFAULT_API_BASE_URL;
}

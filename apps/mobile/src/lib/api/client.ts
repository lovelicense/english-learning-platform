import { getApiBaseUrl } from "../config";
import { clearSession, getToken } from "../auth";

export type ApiFetchOptions = RequestInit & {
  skipAuth?: boolean;
};

async function buildResponse(path: string, options: ApiFetchOptions = {}) {
  const baseUrl = await getApiBaseUrl();
  const headers = new Headers(options.headers ?? {});
  const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth) {
    const token = await getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (response.ok) {
    return response;
  }

  if (response.status === 401 && !options.skipAuth) {
    await clearSession();
  }

  let message = `Request failed with status ${response.status}`;
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      message = data.message.join(", ");
    } else if (data.message) {
      message = data.message;
    }
  } catch {
    // keep fallback message
  }

  throw new Error(message);
}

export async function apiFetchRaw(path: string, options: ApiFetchOptions = {}) {
  return buildResponse(path, options);
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await buildResponse(path, options);

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

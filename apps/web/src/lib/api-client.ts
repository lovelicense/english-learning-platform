import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.message || payload?.error || `API request failed: ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return payload as T;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  return parseResponse<T>(response);
}

export type UploadTask = {
  promise: Promise<void>;
  cancel: () => void;
};

export function createPresignedUploadTask(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): UploadTask {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "audio/webm");

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const percent = Math.min(100, Math.max(1, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`업로드에 실패했습니다. (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("업로드 중 네트워크 오류가 발생했습니다."));
    xhr.onabort = () => reject(new Error("업로드가 취소되었습니다."));
    xhr.send(file);
  });

  return {
    promise,
    cancel: () => xhr.abort(),
  };
}

export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (!onProgress) {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "audio/webm",
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`업로드에 실패했습니다. (${response.status})`);
    }
    return;
  }

  const task = createPresignedUploadTask(uploadUrl, file, onProgress);
  await task.promise;
}

export { API_URL };

import { apiFetchRaw } from "./client";

export type ExportAssetType = "korean" | "english";
export type ExportFormat = "json" | "csv";

export type AssetExportResponse = {
  body: string;
  contentType: string;
  fileName: string;
};

function parseFileName(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const basicMatch = contentDisposition.match(/filename="([^"]+)"/i) ?? contentDisposition.match(/filename=([^;]+)/i);
  if (!basicMatch?.[1]) {
    return fallback;
  }

  return basicMatch[1].trim();
}

export async function exportAssets(assetType: ExportAssetType, format: ExportFormat): Promise<AssetExportResponse> {
  const response = await apiFetchRaw(`/exports/assets/${assetType}?format=${format}`);
  const body = await response.text();
  const fallbackFileName = `english-learning-${assetType}-assets.${format}`;

  return {
    body,
    contentType: response.headers.get("content-type") ?? (format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8"),
    fileName: parseFileName(response.headers.get("content-disposition"), fallbackFileName),
  };
}

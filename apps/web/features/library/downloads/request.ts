import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb } from "@/features/offline/db";

export async function downloadLibraryFormat(
  libraryItemId: string,
  format: "pdf" | "epub",
  getToken: () => Promise<string | null>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const db = getDb();
  const token = await getToken();
  signal.throwIfAborted();
  if (!token || db !== getDb()) throw new Error("ACCOUNT_UNAVAILABLE");
  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(libraryItemId)}/formats/${format}`,
    {
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const mime = format === "epub" ? "application/epub+zip" : "application/pdf";
  if (response.headers.get("content-type")?.split(";")[0].trim() !== mime)
    throw new Error("FORMAT_INVALID");
  const blob = await response.blob();
  if (db !== getDb()) throw new Error("ACCOUNT_CHANGED");
  signal.throwIfAborted();
  return blob;
}

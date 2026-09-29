import { acceptedPdfImportResult } from "./accepted-result";
import { getDb } from "../../../db";
import { revalidateLibrary } from "../revalidate";
import { pdfImportRequest } from "./request";
import { reconcilePdfRequest } from "./reconcile-request";
import {
  rejectPdfUploadIntent,
  settlePdfUploadIntent,
  storePdfUploadIntent,
} from "./storage";
import type { GetToken, ImportResult } from "./types";

export async function importPdfFile(
  file: File,
  getToken: GetToken,
): Promise<ImportResult> {
  const db = getDb();
  if (file.size > 50 * 1024 * 1024)
    return { state: "rejected", code: "PDF_TOO_LARGE" };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const sourceSha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const intent = await storePdfUploadIntent(db, {
    requestKey: crypto.randomUUID(),
    sourceSha256,
    filename: file.name,
    createdAt: new Date().toISOString(),
  });
  if (!intent || db !== getDb()) return { state: "uncertain" };
  try {
    const existing = await reconcilePdfRequest(db, getToken, intent);
    if (existing) {
      await revalidateLibrary(getToken);
      if (db !== getDb()) return { state: "uncertain" };
      return acceptedPdfImportResult(db, "existing", existing.libraryItemId);
    }
    const body = new FormData();
    body.append("file", file);
    body.append("convertToEpub", "true");
    const response = await pdfImportRequest(db, getToken, "", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": intent.requestKey },
    });
    const payload = (await response.json().catch(() => null)) as {
      libraryItemId?: string;
      code?: string;
    } | null;
    if (db !== getDb()) return { state: "uncertain" };
    if (
      (response.ok || payload?.code === "PDF_ALREADY_IMPORTED") &&
      payload?.libraryItemId
    ) {
      await settlePdfUploadIntent(db, intent, payload.libraryItemId);
      await revalidateLibrary(getToken);
      if (db !== getDb()) return { state: "uncertain" };
      return acceptedPdfImportResult(
        db,
        response.ok ? "accepted" : "existing",
        payload.libraryItemId,
      );
    }
    if (response.status >= 500) return { state: "uncertain" };
    await rejectPdfUploadIntent(db, intent);
    return { state: "rejected", code: payload?.code };
  } catch {
    return { state: "uncertain" };
  }
}

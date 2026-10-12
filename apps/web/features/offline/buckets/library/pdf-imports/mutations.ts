import { acceptedPdfImportResult } from "./accepted-result";
import { getDb, type AvaReaderDB } from "../../../db";
import { revalidateLibrary } from "../revalidate";
import { pdfImportRequest } from "./request";
import {
  reconcilePdfRequest,
  type PdfRequestLookup,
} from "./reconcile-request";
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
  const requestKey = crypto.randomUUID();
  const intent = await storePdfUploadIntent(db, {
    requestKey,
    sourceSha256,
    filename: file.name,
    createdAt: new Date().toISOString(),
  });
  if (!intent || db !== getDb()) return { state: "uncertain" };
  try {
    const existing = await reconcilePdfRequest(db, getToken, intent);
    const known = await knownPdfRequestResult(db, getToken, existing);
    if (known) return known;
    // Only a brand-new intent may start an upload. An unresolved prior request
    // is observed with GET; missing/ambiguous results never resend its bytes.
    if (existing?.state !== "missing" || intent.requestKey !== requestKey)
      return { state: "uncertain" };
    const body = new FormData();
    body.append("file", file);
    body.append("originalFilename", file.name);
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
      typeof payload?.libraryItemId === "string" &&
      payload.libraryItemId.trim().length > 0 &&
      payload.libraryItemId.length <= 200
    ) {
      if (!(await settlePdfUploadIntent(db, intent, payload.libraryItemId)))
        return { state: "uncertain" };
      await revalidateLibrary(getToken);
      if (db !== getDb()) return { state: "uncertain" };
      return acceptedPdfImportResult(
        db,
        response.ok ? "accepted" : "existing",
        payload.libraryItemId,
      );
    }
    if (response.status >= 500) {
      const lookup = await reconcilePdfRequest(db, getToken, intent);
      return (
        (await knownPdfRequestResult(db, getToken, lookup)) ?? {
          state: "uncertain",
        }
      );
    }
    if (
      response.ok ||
      payload?.code === "PDF_ALREADY_IMPORTED" ||
      typeof payload?.code !== "string" ||
      !payload.code
    )
      return { state: "uncertain" };
    if (!(await rejectPdfUploadIntent(db, intent)))
      return { state: "uncertain" };
    return { state: "rejected", code: payload.code };
  } catch {
    return { state: "uncertain" };
  }
}

async function knownPdfRequestResult(
  db: AvaReaderDB,
  getToken: GetToken,
  lookup: PdfRequestLookup | null,
): Promise<ImportResult | null> {
  if (db !== getDb()) return { state: "uncertain" };
  if (lookup?.state === "refused")
    return { state: "rejected", code: lookup.code };
  if (lookup?.state !== "accepted") return null;
  await revalidateLibrary(getToken);
  return acceptedPdfImportResult(db, "existing", lookup.status.libraryItemId);
}

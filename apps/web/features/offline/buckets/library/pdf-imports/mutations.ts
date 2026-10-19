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
import type { GetToken, ImportResult, PdfCopyChoice } from "./types";

export async function importPdfFile(
  file: File,
  getToken: GetToken,
  copy?: PdfCopyChoice,
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
  const intent = await storePdfUploadIntent(
    db,
    {
      requestKey,
      sourceSha256,
      filename: file.name,
      createdAt: new Date().toISOString(),
      ...(copy ? { copyOfOperationId: copy.operationId } : {}),
    },
    copy?.requestKey,
  );
  if (!intent || db !== getDb()) return { state: "uncertain" };
  try {
    const existing = await reconcilePdfRequest(db, getToken, intent);
    const known = await knownPdfRequestResult(
      db,
      getToken,
      existing,
      !copy && Boolean(intent.libraryItemId) ? intent.requestKey : undefined,
    );
    if (known) return known;
    // Only a brand-new intent may start an upload. An unresolved prior request
    // is observed with GET; missing/ambiguous results never resend its bytes.
    if (existing?.state !== "missing" || intent.requestKey !== requestKey)
      return { state: "uncertain" };
    const body = new FormData();
    body.append("file", file);
    body.append("originalFilename", file.name);
    body.append("convertToEpub", "true");
    if (intent.copyOfOperationId)
      body.append("copyOfOperationId", intent.copyOfOperationId);
    const response = await pdfImportRequest(db, getToken, "", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": intent.requestKey },
    });
    const payload = (await response.json().catch(() => null)) as {
      libraryItemId?: string;
      operationId?: string;
      code?: string;
    } | null;
    if (db !== getDb()) return { state: "uncertain" };
    if (
      (response.ok || payload?.code === "PDF_ALREADY_IMPORTED") &&
      typeof payload?.libraryItemId === "string" &&
      payload.libraryItemId.trim().length > 0 &&
      payload.libraryItemId.length <= 200 &&
      (response.ok ||
        (typeof payload.operationId === "string" &&
          /^[A-Za-z0-9_-]{1,200}$/.test(payload.operationId)))
    ) {
      if (
        !(await settlePdfUploadIntent(
          db,
          intent,
          payload.libraryItemId,
          response.ok ? undefined : payload.operationId,
        ))
      )
        return { state: "uncertain" };
      await revalidateLibrary(getToken);
      if (db !== getDb()) return { state: "uncertain" };
      const accepted = await acceptedPdfImportResult(
        db,
        response.ok ? "accepted" : "existing",
        payload.libraryItemId,
      );
      return !response.ok && accepted.state === "existing"
        ? {
            ...accepted,
            state: "duplicate",
            operationId: payload.operationId,
            requestKey: intent.requestKey,
          }
        : accepted;
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
  duplicateRequestKey?: string,
): Promise<ImportResult | null> {
  if (db !== getDb()) return { state: "uncertain" };
  if (lookup?.state === "refused")
    return { state: "rejected", code: lookup.code };
  if (lookup?.state !== "accepted") return null;
  await revalidateLibrary(getToken);
  const result = await acceptedPdfImportResult(
    db,
    "existing",
    lookup.status.libraryItemId,
  );
  return duplicateRequestKey && result.state === "existing"
    ? {
        ...result,
        state: "duplicate",
        operationId: lookup.status.operationId,
        requestKey: duplicateRequestKey,
      }
    : result;
}

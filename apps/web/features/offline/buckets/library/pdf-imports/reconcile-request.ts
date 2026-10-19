import type { PdfImportSummary } from "@/lib/api-types/pdf-import";
import { getDb, type AvaReaderDB } from "../../../db";
import { pdfImportRequest } from "./request";
import { readPdfImportStatus } from "./read-status";
import { rejectPdfUploadIntent, settlePdfUploadIntent } from "./storage";
import type { GetToken, PdfUploadIntent } from "./types";

export type PdfRequestLookup =
  | { state: "accepted"; status: PdfImportSummary }
  | { state: "refused"; code: "PDF_ADMISSION_REFUSED" }
  | { state: "missing" };

export async function reconcilePdfRequest(
  db: AvaReaderDB,
  getToken: GetToken,
  intent: PdfUploadIntent,
): Promise<PdfRequestLookup | null> {
  const response = await pdfImportRequest(
    db,
    getToken,
    intent.duplicateOperationId
      ? `/${encodeURIComponent(intent.duplicateOperationId)}`
      : `/requests/${encodeURIComponent(intent.requestKey)}`,
  );
  if (response.status === 404) return { state: "missing" };
  const payload = await response.json().catch(() => null);
  if (db !== getDb()) return null;
  if (
    response.status === 410 &&
    payload &&
    typeof payload === "object" &&
    payload.code === "PDF_ADMISSION_REFUSED" &&
    payload.requestKey === intent.requestKey &&
    payload.sourceSha256 === intent.sourceSha256 &&
    /^[a-f0-9]{64}$/.test(payload.sourceSha256) &&
    typeof payload.investigationId === "string" &&
    payload.investigationId.trim().length > 0 &&
    payload.investigationId.length <= 200 &&
    payload.operationId === null
  ) {
    return (await rejectPdfUploadIntent(db, intent, "PDF_ADMISSION_REFUSED"))
      ? { state: "refused", code: "PDF_ADMISSION_REFUSED" }
      : null;
  }
  if (!response.ok) return null;
  const status = readPdfImportStatus(payload);
  if (
    !status ||
    !status.libraryItemId.trim() ||
    status.libraryItemId.length > 200 ||
    !status.operationId.trim() ||
    status.operationId.length > 200 ||
    !(await settlePdfUploadIntent(db, intent, status.libraryItemId))
  )
    return null;
  return { state: "accepted", status };
}

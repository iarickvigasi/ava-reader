import { getDb, type AvaReaderDB } from "../../../db";
import { pdfImportRequest } from "./request";
import { readPdfImportStatus } from "./read-status";
import { settlePdfUploadIntent } from "./storage";
import type { GetToken, PdfUploadIntent } from "./types";

export async function reconcilePdfRequest(
  db: AvaReaderDB,
  getToken: GetToken,
  intent: PdfUploadIntent,
) {
  const response = await pdfImportRequest(
    db,
    getToken,
    `/requests/${encodeURIComponent(intent.requestKey)}`,
  );
  if (!response.ok) return null;
  const status = readPdfImportStatus(await response.json());
  if (!status || db !== getDb()) return null;
  await settlePdfUploadIntent(db, intent, status.libraryItemId);
  return status;
}

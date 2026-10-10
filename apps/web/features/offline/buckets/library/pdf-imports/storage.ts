import { getDb, type AvaReaderDB } from "../../../db";
import type { PdfUploadIntent } from "./types";

export const PDF_REQUEST_PREFIX = "pdf-upload-request:";
export async function storePdfUploadIntent(
  db: AvaReaderDB,
  intent: PdfUploadIntent,
) {
  if (db !== getDb()) return null;
  return db.transaction("rw", db.meta, async () => {
    if (db !== getDb()) return null;
    const key = PDF_REQUEST_PREFIX + intent.sourceSha256;
    const prior = await db.meta.get(key);
    if (prior) return prior.value as PdfUploadIntent;
    await db.meta.put({ key, value: intent, updatedAt: intent.createdAt });
    return intent;
  });
}

export async function settlePdfUploadIntent(
  db: AvaReaderDB,
  intent: PdfUploadIntent,
  libraryItemId: string,
) {
  if (db !== getDb()) return;
  await db.meta.put({
    key: PDF_REQUEST_PREFIX + intent.sourceSha256,
    value: { ...intent, libraryItemId },
    updatedAt: new Date().toISOString(),
  });
}

export async function pendingPdfUploadIntents(db: AvaReaderDB) {
  const rows = await db.meta
    .where("key")
    .startsWith(PDF_REQUEST_PREFIX)
    .toArray();
  return rows
    .map((row) => row.value as PdfUploadIntent)
    .filter((row) => !row.libraryItemId && !row.rejected)
    .slice(0, 10);
}

export async function rejectPdfUploadIntent(
  db: AvaReaderDB,
  intent: PdfUploadIntent,
) {
  if (db !== getDb()) return;
  await db.meta.put({
    key: PDF_REQUEST_PREFIX + intent.sourceSha256,
    value: { ...intent, rejected: true },
    updatedAt: new Date().toISOString(),
  });
}

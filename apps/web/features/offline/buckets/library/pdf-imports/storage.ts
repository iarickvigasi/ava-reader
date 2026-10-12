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
    const prior = (await db.meta.get(key))?.value as
      | PdfUploadIntent
      | undefined;
    if (prior && prior.sourceSha256 !== intent.sourceSha256) return null;
    if (
      prior &&
      !(
        prior.rejected === true &&
        prior.refusalCode === "PDF_ADMISSION_REFUSED" &&
        !prior.libraryItemId
      )
    )
      return prior;
    if (db !== getDb()) return null;
    await db.meta.put({ key, value: intent, updatedAt: intent.createdAt });
    return intent;
  });
}

export async function settlePdfUploadIntent(
  db: AvaReaderDB,
  intent: PdfUploadIntent,
  libraryItemId: string,
) {
  if (db !== getDb()) return false;
  return db.transaction("rw", db.meta, async () => {
    const key = PDF_REQUEST_PREFIX + intent.sourceSha256;
    const current = (await db.meta.get(key))?.value as
      | PdfUploadIntent
      | undefined;
    if (
      db !== getDb() ||
      current?.requestKey !== intent.requestKey ||
      current.sourceSha256 !== intent.sourceSha256 ||
      (current.libraryItemId && current.libraryItemId !== libraryItemId)
    )
      return false;
    await db.meta.put({
      key,
      value: { ...current, libraryItemId },
      updatedAt: new Date().toISOString(),
    });
    return true;
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
  refusalCode?: "PDF_ADMISSION_REFUSED",
) {
  if (db !== getDb()) return false;
  return db.transaction("rw", db.meta, async () => {
    const key = PDF_REQUEST_PREFIX + intent.sourceSha256;
    const current = (await db.meta.get(key))?.value as
      | PdfUploadIntent
      | undefined;
    if (
      db !== getDb() ||
      current?.requestKey !== intent.requestKey ||
      current.sourceSha256 !== intent.sourceSha256 ||
      current.libraryItemId
    )
      return false;
    await db.meta.put({
      key,
      value: {
        ...current,
        rejected: true,
        ...(refusalCode ? { refusalCode } : {}),
      },
      updatedAt: new Date().toISOString(),
    });
    return true;
  });
}

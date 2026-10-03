import { getDb, type AvaReaderDB } from "../../../../db";
import { pdfImportRequest } from "../request";
import type { GetToken } from "../types";
import { isLibraryItemDeleted } from "../../deleted-items";
import { storePdfNotices } from "./storage";
import { PDF_NOTICE_PREFIX, readPdfNotice, type PdfNotice } from "./types";

export async function syncPdfNotices(db: AvaReaderDB, getToken: GetToken) {
  if (db !== getDb()) return false;
  const rows = await db.meta
    .where("key")
    .startsWith(PDF_NOTICE_PREFIX)
    .toArray();
  for (const row of rows) {
    const notice = row.value as PdfNotice;
    if (db !== getDb()) return false;
    if (!notice.dirty || (await isLibraryItemDeleted(db, notice.libraryItemId)))
      continue;
    const result = await pdfImportRequest(
      db,
      getToken,
      `/notifications/${encodeURIComponent(notice.id)}/${notice.dirty}`,
      { method: "POST" },
    );
    if (!result.ok && result.status !== 404 && result.status !== 410)
      throw new Error("NOTICE_UNAVAILABLE");
    if (db !== getDb()) return false;
    await db.transaction("rw", db.meta, async () => {
      const latest = (await db.meta.get(row.key))?.value as
        | PdfNotice
        | undefined;
      if (db !== getDb() || !latest || latest.dirty !== notice.dirty) return;
      await db.meta.put({
        ...row,
        value: {
          ...latest,
          dirty: null,
          ...(!result.ok ? { acknowledgedAt: new Date().toISOString() } : {}),
        },
      });
    });
  }
  const result = await pdfImportRequest(db, getToken, "/notifications");
  if (!result.ok) throw new Error("NOTICE_UNAVAILABLE");
  const body = (await result.json()) as {
    notifications?: unknown[];
    complete?: boolean;
  };
  if (!Array.isArray(body.notifications) || body.notifications.length > 100)
    throw new Error("INVALID_NOTICES");
  const notices = body.notifications.map(readPdfNotice);
  if (notices.some((n) => !n)) throw new Error("INVALID_NOTICES");
  if (db !== getDb()) return false;
  const valid = notices as PdfNotice[];
  const unknownItem = (
    await Promise.all(valid.map((n) => db.libraryItems.get(n.libraryItemId)))
  ).some((item) => !item);
  await storePdfNotices(db, valid);
  const knownBeforeRequest = new Set(rows.map((row) => row.key));
  if (body.complete === true)
    await db.transaction("rw", db.meta, async () => {
      if (db !== getDb()) return;
      const pending = new Set(valid.map((n) => n.id));
      for (const row of await db.meta
        .where("key")
        .startsWith(PDF_NOTICE_PREFIX)
        .toArray()) {
        const notice = row.value as PdfNotice;
        if (
          knownBeforeRequest.has(row.key) &&
          !pending.has(notice.id) &&
          !notice.dirty &&
          !notice.acknowledgedAt
        )
          await db.meta.put({
            ...row,
            value: {
              ...notice,
              acknowledgedAt: new Date().toISOString(),
              dirty: null,
            },
          });
      }
    });
  return unknownItem;
}

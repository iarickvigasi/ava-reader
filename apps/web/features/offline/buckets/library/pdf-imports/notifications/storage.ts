import { getDb, type AvaReaderDB } from "../../../../db";
import { isLibraryItemDeleted } from "../../deleted-items";
import { PDF_NOTICE_PREFIX, type PdfNotice, type PdfNoticeView } from "./types";

export async function storePdfNotices(db: AvaReaderDB, notices: PdfNotice[]) {
  if (db !== getDb()) return;
  await db.transaction("rw", db.meta, async () => {
    if (db !== getDb()) return;
    for (const notice of notices) {
      if (await isLibraryItemDeleted(db, notice.libraryItemId)) continue;
      const key = PDF_NOTICE_PREFIX + notice.id;
      const prior = (await db.meta.get(key))?.value as PdfNotice | undefined;
      if (
        prior &&
        (prior.operationId !== notice.operationId ||
          prior.libraryItemId !== notice.libraryItemId ||
          prior.kind !== notice.kind)
      )
        continue;
      const merged = {
        ...notice,
        deliveredAt: prior?.deliveredAt ?? notice.deliveredAt,
        acknowledgedAt: prior?.acknowledgedAt,
        dirty: prior?.dirty,
      };
      await db.meta.put({
        key,
        value: merged,
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

export async function readPdfNotices(
  db: AvaReaderDB,
): Promise<PdfNoticeView[]> {
  if (db !== getDb()) return [];
  const rows = await db.meta
    .where("key")
    .startsWith(PDF_NOTICE_PREFIX)
    .toArray();
  const visible: PdfNoticeView[] = [];
  for (const row of rows) {
    const notice = row.value as PdfNotice;
    if (
      notice.acknowledgedAt ||
      (await isLibraryItemDeleted(db, notice.libraryItemId))
    )
      continue;
    const item = await db.libraryItems.get(notice.libraryItemId);
    if (item?.pdfImport?.operationId === notice.operationId)
      visible.push({ ...notice, title: item.title, slug: item.slug });
  }
  return db === getDb()
    ? visible.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
}

export async function markPdfNotice(
  db: AvaReaderDB,
  id: string,
  action: "delivered" | "acknowledged",
) {
  if (db !== getDb()) return;
  await db.transaction("rw", db.meta, async () => {
    if (db !== getDb()) return;
    const key = PDF_NOTICE_PREFIX + id;
    const row = await db.meta.get(key);
    const notice = row?.value as PdfNotice | undefined;
    if (
      !notice ||
      notice.acknowledgedAt ||
      (await isLibraryItemDeleted(db, notice.libraryItemId))
    )
      return;
    if (action === "delivered" && notice.deliveredAt) return;
    const now = new Date().toISOString();
    await db.meta.put({
      key,
      updatedAt: now,
      value: {
        ...notice,
        deliveredAt: notice.deliveredAt ?? now,
        dirty: action,
        ...(action === "acknowledged" ? { acknowledgedAt: now } : {}),
      },
    });
  });
}

import "fake-indexeddb/auto";
import { getDb } from "../../../db";
import { applyBookInfoPayload } from "../book-info/write-book-info";
import { mergeListPayloadItemRow } from "../collections/item-row";
import { bookToItemRow } from "../collections/payload-rows";
import { applyPdfImportStatus } from "./apply-status";
import { book } from "./metadata/test-fixture";
import { pdfStatus } from "./test-fixture";
export const ready = {
  ...book,
  language: "en",
  title: "The extracted title",
  metadataEditVersion: 1,
  approximatePageCount: 8,
  pdfImport: {
    ...pdfStatus,
    status: "READY" as const,
    stage: "COMPLETE",
    finalContentId: "content-one",
    updatedAt: "2026-09-29T10:01:00.000Z",
  },
};
export async function seedTransition() {
  const db = getDb();
  await applyBookInfoPayload({ ...book, language: null });
  await applyPdfImportStatus(db, ready.pdfImport);
  // The real list response advances card metadata but omits full details.
  await db.libraryItems.put(
    mergeListPayloadItemRow(
      bookToItemRow(
        { ...ready, lastReadAt: "2026-09-29T10:01:00.000Z" },
        "now",
      ),
      await db.libraryItems.get(book.libraryItemId),
    ),
  );
  return db;
}

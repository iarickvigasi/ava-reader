import type { AvaReaderDB } from "../../../../db";
import { PDF_NOTICE_PREFIX, type PdfNotice } from "./types";

// Runs inside the existing library-removal transaction, including meta.
export async function prunePdfNotices(db: AvaReaderDB, removed: Set<string>) {
  const rows = await db.meta
    .where("key")
    .startsWith(PDF_NOTICE_PREFIX)
    .toArray();
  await db.meta.bulkDelete(
    rows
      .filter((row) => removed.has((row.value as PdfNotice).libraryItemId))
      .map((row) => row.key),
  );
}

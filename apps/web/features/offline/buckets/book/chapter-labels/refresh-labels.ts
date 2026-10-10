import type {
  ReaderBookPayload,
  ReaderStatusPayload,
  ReaderTocNode,
} from "@/lib/api-types/reader";
import { getActiveUserId, getDb, type AvaReaderDB } from "../../../db";
import { writeUnlessDeleted } from "../../library/deleted-items";
import { hasLegacyLabels, patchLegacyLabels } from "./patch-labels";
import { findHeadingExcerpts } from "./find-heading-excerpts";

type Input = {
  userId: string;
  fetchReader: (id: string) => Promise<ReaderStatusPayload>;
};
const pending = new WeakMap<AvaReaderDB, Promise<void>>();

// Temporary, idempotent device-side script. Retry unresolved labels on later passes.
export function refreshDownloadedChapterLabels(input: Input): Promise<void> {
  if (getActiveUserId() !== input.userId) return Promise.resolve();
  const db = getDb();
  const existing = pending.get(db);
  if (existing) return existing;
  const attempt = refreshBooks(db, input).finally(() => pending.delete(db));
  pending.set(db, attempt);
  return attempt;
}

async function refreshBooks(db: AvaReaderDB, input: Input) {
  const current = () => getActiveUserId() === input.userId && getDb() === db;
  const ids = await db.books.toCollection().primaryKeys();
  for (const id of ids) {
    if (!current()) return;
    try {
      const book = await db.books.get(id);
      if (
        !book ||
        book.canonical?.readerPackage ||
        (book.metadata as ReaderBookPayload)?.primaryFormat !== "EPUB"
      )
        continue;
      const headingExcerpts = await findHeadingExcerpts(db, book);
      if (
        !headingExcerpts.size &&
        !hasLegacyLabels((book.toc ?? []) as ReaderTocNode[])
      )
        continue;
      if (!current()) return;
      const payload = await input.fetchReader(id);
      if (!current()) return;
      if (payload.status !== "READY" || payload.book.libraryItemId !== id)
        continue;
      await writeUnlessDeleted(db, id, [db.books], async () => {
        if (!current()) return;
        await db.books
          .where("libraryItemId")
          .equals(id)
          .modify((row) => {
            if (!current() || row.canonical?.readerPackage) return;
            const toc = patchLegacyLabels(
              (row.toc ?? []) as ReaderTocNode[],
              payload.toc,
              headingExcerpts,
            );
            if (toc) row.toc = toc;
          });
      });
    } catch {
      // A missing book, unavailable server, or closed account DB retries later.
      // One failed book must not prevent the remaining downloads from refreshing.
    }
  }
}

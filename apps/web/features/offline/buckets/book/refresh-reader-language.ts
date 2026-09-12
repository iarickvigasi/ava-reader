import type { ReaderBookPayload } from "@/lib/api-types/reader";

import { getActiveUserId, getDb, type AvaReaderDB } from "../../db";
import { readKnownReaderLanguage } from "./reader-language";

type RefreshInput = {
  libraryItemId: string;
  userId: string;
  fetchLanguage: () => Promise<string | null | undefined>;
};

const pendingByDb = new WeakMap<AvaReaderDB, Map<string, Promise<void>>>();

// Success is recorded in metadata itself (including null); failures can retry
// on the next open/reconnect. Concurrent readers share one attempt per user DB.
export function refreshReaderLanguage(input: RefreshInput): Promise<void> {
  if (getActiveUserId() !== input.userId) return Promise.resolve();
  const db = getDb();
  const pending = pendingByDb.get(db) ?? new Map<string, Promise<void>>();
  pendingByDb.set(db, pending);
  const existing = pending.get(input.libraryItemId);
  if (existing) return existing;
  const attempt = fillMissingLanguage(db, input).finally(() => {
    pending.delete(input.libraryItemId);
  });
  pending.set(input.libraryItemId, attempt);
  return attempt;
}

async function fillMissingLanguage(db: AvaReaderDB, input: RefreshInput): Promise<void> {
  const current = () => getActiveUserId() === input.userId && getDb() === db;
  const book = await db.books.get(input.libraryItemId);
  if (!book || readKnownReaderLanguage(book.metadata) !== undefined || !current()) return;

  const item = await db.libraryItems.get(input.libraryItemId);
  if (!current()) return;
  const cached = readKnownReaderLanguage(item?.details);
  const language = cached === undefined ? await input.fetchLanguage() : cached;
  if (!current()) return;
  if (language !== null && typeof language !== "string") {
    throw new Error("The reader response did not include book language.");
  }

  // Modify only an existing row, atomically. A concurrent save may have filled
  // the field, or removal/account switching may have invalidated this work.
  await db.books.where("libraryItemId").equals(input.libraryItemId).modify((row) => {
    if (current() && readKnownReaderLanguage(row.metadata) === undefined) {
      row.metadata = { ...(row.metadata as ReaderBookPayload), language };
    }
  });
}

// The library-wide book total, kept exactly as the server computed it.
//
// It can't be re-derived from the cached rows: `applyLibraryPayload` stores
// only each collection's preview subset, so counting rows reports a fraction
// of the library. Storing the scalar in the shared `meta` key/value table
// keeps the header metric identical online and from cache — see
// docs/specs/7-library/7.1-library-screen.md §5.

import { getDb } from "../../db";

const META_KEY_BOOKS_COUNT = "library:booksCount";

// Both accessors run inside the caller's Dexie transaction, so `meta` has to
// be in that transaction's table list.

export async function writeLibraryBooksCountTx(count: number): Promise<void> {
  await getDb().meta.put({
    key: META_KEY_BOOKS_COUNT,
    value: count,
    updatedAt: new Date().toISOString(),
  });
}

// Null when nothing has been stored yet — a cache seeded only by a collection
// page never saw a library-wide summary.
export async function readLibraryBooksCountTx(): Promise<number | null> {
  const row = await getDb().meta.get(META_KEY_BOOKS_COUNT);
  return typeof row?.value === "number" ? row.value : null;
}

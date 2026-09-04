// Slug → libraryItemId against the cached library. Its own module because its
// caller is the reader, not the library screen: the reader shell resolves the
// slug from location.pathname before touching the per-book content tables.

import { getDb } from "../../db";

// Resolves a book slug to its libraryItemId from the cached library. Used by
// the reader shell loader (ADR 4) before touching the per-book content tables.
export async function readLibraryItemIdBySlug(
  slug: string,
): Promise<string | null> {
  const db = getDb();
  const row = await db.libraryItems.where("slug").equals(slug).first();
  return row?.libraryItemId ?? null;
}

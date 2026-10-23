import Dexie, { type Transaction } from "dexie";
import type { LibraryItemRow } from "../../../library-item-row";
import type { CoverRow } from "./types";
import { encodeCover } from "./encode";

type LegacyLibraryItem = LibraryItemRow & { coverBlob?: Blob | null };

// Upgrade is atomic: a failed database write rolls back both the new cover
// and removal of the legacy field. Blob I/O/crypto must keep the IDB tx alive.
export async function migrateLegacyCovers(tx: Transaction): Promise<void> {
  const items = tx.table<LegacyLibraryItem, string>("libraryItems");
  for (const id of await items.toCollection().primaryKeys()) {
    const row = await items.get(id);
    if (!row || !("coverBlob" in row)) continue;
    let cover: CoverRow | undefined;
    try {
      if (row.coverBlob) {
        cover = await Dexie.waitFor(
          encodeCover(row.coverBlob, {
            libraryItemId: row.libraryItemId,
            sourceUrl: row.coverImageUrl,
            verified: false,
          }),
        );
      }
    } catch {
      // An unreadable/mismatched legacy cover becomes a repairable cache miss.
    }
    if (cover) await tx.table("bookCovers").put(cover);
    delete row.coverBlob;
    await items.put(row);
  }
}

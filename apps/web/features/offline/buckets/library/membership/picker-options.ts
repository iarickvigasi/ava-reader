import { getDb } from "../../../db";
import { readLibraryView } from "../collections/read-library";
import { readLibraryBooksCountTx } from "../collections/summary-store";
import type { CollectionView } from "../types";

export async function readCollectionPickerOptions(): Promise<CollectionView[] | null> {
  const db = getDb();
  const complete = await db.transaction("r", db.meta, () => readLibraryBooksCountTx());
  if (complete === null) return null;
  const view = await readLibraryView();
  return view?.collections.filter((collection) => collection.kind === "CUSTOM") ?? [];
}

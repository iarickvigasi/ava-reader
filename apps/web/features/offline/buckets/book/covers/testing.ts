import { getDb, __resetDbForTests } from "../../../db";
import { payload } from "../../library/test-fixture";
import { applyCollectionPayload } from "../../library/collections/write-library";
import { clearWarmCover } from "../warm-cover";

export async function seedCoverItems() {
  const collection = payload().collections[0];
  for (const book of collection.books)
    book.coverImageUrl = `/api/library/covers/${book.libraryItemId}`;
  await applyCollectionPayload(collection);
  return collection;
}

export async function cleanCoverTest() {
  clearWarmCover();
  await getDb().delete();
  __resetDbForTests();
}

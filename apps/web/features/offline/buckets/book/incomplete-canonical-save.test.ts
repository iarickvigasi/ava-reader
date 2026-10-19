import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../db";
import { __resetBookBucketForTests, getBookSaveSnapshot } from "./bucket";
import { saveBookOffline } from "./download";
import { failedResourcePayload } from "@/features/reader/canonical/resource-recovery-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
});

it("never writes offline-completion or partial reader rows for an unavailable accepted resource", async () => {
  const payload = failedResourcePayload(),
    libraryItemId = payload.book.libraryItemId;
  const result = await saveBookOffline({
    libraryItemId,
    saveKind: "explicit",
    fetchChapter: async () => payload,
  });
  expect(result).toMatchObject({
    kind: "failed",
    reason: "Reader resources are incomplete",
  });
  expect(await getDb().books.get(libraryItemId)).toBeUndefined();
  expect(await getDb().bookChapters.count()).toBe(0);
  expect(getBookSaveSnapshot(libraryItemId)).toMatchObject({
    status: "failed",
  });
});

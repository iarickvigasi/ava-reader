import "fake-indexeddb/auto";
import { beforeEach, afterEach, expect, it } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { bookToItemRow } from "../collections/payload-rows";
import { payload } from "../test-fixture";
import { DELETED_ITEM_PREFIX } from "../deleted-items";
import { acceptedPdfImportResult } from "./accepted-result";
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => __resetDbForTests());
it("resolves the receipt item to its owned cached slug", async () => {
  const db = getDb();
  const row = bookToItemRow(
    payload().collections[0].books[0],
    new Date().toISOString(),
  );
  await db.libraryItems.put(row);
  expect(
    await acceptedPdfImportResult(db, "accepted", row.libraryItemId),
  ).toEqual({
    state: "accepted",
    libraryItemId: row.libraryItemId,
    slug: row.slug,
  });
});
it("keeps acceptance without inventing a URL when revalidation is unavailable", async () => {
  expect(await acceptedPdfImportResult(getDb(), "existing", "id")).toEqual({
    state: "existing",
    libraryItemId: "id",
  });
});
it("does not return a stale item after deletion or account change", async () => {
  const db = getDb();
  await db.meta.put({
    key: DELETED_ITEM_PREFIX + "id",
    value: true,
    updatedAt: new Date().toISOString(),
  });
  expect(await acceptedPdfImportResult(db, "accepted", "id")).toEqual({
    state: "uncertain",
  });
  setActiveUser("navigation-other-account");
  expect(await acceptedPdfImportResult(db, "accepted", "id")).toEqual({
    state: "uncertain",
  });
  await getDb().delete();
});

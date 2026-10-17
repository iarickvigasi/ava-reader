import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../../db";
import { bookToItemRow } from "../collections/payload-rows";
import { payload } from "../test-fixture";
import { DELETED_ITEM_PREFIX } from "../deleted-items";
import { applyPdfImportStatus } from "./apply-status";
import { storePdfUploadIntent } from "./storage";
import { pdfStatus } from "./test-fixture";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(() => __resetDbForTests());
it("shares one upload key between concurrent tabs selecting identical bytes", async () => {
  const db = getDb();
  const intent = {
    sourceSha256: "sha",
    filename: "book.pdf",
    createdAt: new Date().toISOString(),
  };
  const [a, b] = await Promise.all([
    storePdfUploadIntent(db, { ...intent, requestKey: "first" }),
    storePdfUploadIntent(db, { ...intent, requestKey: "second" }),
  ]);
  expect(a?.requestKey).toBe(b?.requestKey);
});
it("changes only status and never restores a deleted item", async () => {
  const db = getDb();
  const row = bookToItemRow(
    payload().collections[0].books[0],
    new Date().toISOString(),
  );
  await db.libraryItems.put({ ...row, title: "My corrected title" });
  const status = { ...pdfStatus, libraryItemId: row.libraryItemId };
  await applyPdfImportStatus(db, status);
  expect((await db.libraryItems.get(row.libraryItemId))?.title).toBe(
    "My corrected title",
  );
  await db.meta.put({
    key: DELETED_ITEM_PREFIX + row.libraryItemId,
    value: true,
    updatedAt: status.updatedAt,
  });
  await db.libraryItems.delete(row.libraryItemId);
  expect(await applyPdfImportStatus(db, status)).toBe(false);
  expect(await db.libraryItems.get(row.libraryItemId)).toBeUndefined();
});
it("refuses status writes after an account change", async () => {
  const priorDb = getDb();
  setActiveUser("pdf-status-next-account");
  await getDb().delete();
  await getDb().open();
  expect(await applyPdfImportStatus(priorDb, pdfStatus)).toBe(false);
  expect(await getDb().libraryItems.count()).toBe(0);
  await getDb().delete();
});

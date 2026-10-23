import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { getDb } from "../../../db";
import { applyCollectionPayload } from "../../library/collections/write-library";
import { removeCachedLibraryItems } from "../../library/remove-cached-items";
import { markBookSaved } from "../storage";
import { attachCoverBlob } from "./attach";
import { readCoverBlob } from "./read";
import { cleanCoverTest, seedCoverItems } from "./testing";

afterEach(async () => {
  vi.restoreAllMocks();
  await cleanCoverTest();
});

it("metadata refresh, reordering, and saved flags never write cover records", async () => {
  const collection = await seedCoverItems();
  const db = getDb();
  for (const book of collection.books)
    await attachCoverBlob(book.libraryItemId, new Blob([book.title]));
  const original = await db.bookCovers.toArray();
  const put = vi.spyOn(db.bookCovers, "put");
  await applyCollectionPayload({
    ...collection,
    books: [...collection.books].reverse(),
  });
  await markBookSaved(collection.books[0].libraryItemId, "auto");
  expect(put).not.toHaveBeenCalled();
  expect(await db.bookCovers.toArray()).toEqual(original);
  expect(await db.libraryItems.toArray()).toEqual(
    expect.arrayContaining([
      expect.not.objectContaining({ coverBlob: expect.anything() }),
    ]),
  );
});

it("stores independent bytes and refuses to overwrite a verified immutable cover", async () => {
  await seedCoverItems();
  const blob = new Blob(["first"], { type: "image/png" });
  await attachCoverBlob("lib-1", blob);
  await attachCoverBlob("lib-1", new Blob(["another book"]));
  expect(await (await readCoverBlob("lib-1"))!.text()).toBe("first");
  const row = await getDb().bookCovers.get("lib-1");
  expect(row?.bytes).toBeInstanceOf(ArrayBuffer);
  expect(row?.verified).toBe(true);
  expect(await readCoverBlob("lib-2")).toBeNull();
});

it("rejects same-length changed bytes and repairs the invalid record", async () => {
  await seedCoverItems();
  await attachCoverBlob("lib-1", new Blob(["first"]));
  await getDb().bookCovers.update("lib-1", {
    bytes: new TextEncoder().encode("wrong").buffer,
  });
  expect(await readCoverBlob("lib-1")).toBeNull();
  await attachCoverBlob("lib-1", new Blob(["fixed"]));
  expect(await (await readCoverBlob("lib-1"))!.text()).toBe("fixed");
});

it("deleting a library item removes its independent cover", async () => {
  await seedCoverItems();
  await attachCoverBlob("lib-1", new Blob(["cover"]));
  await removeCachedLibraryItems(["lib-1"]);
  expect(await getDb().bookCovers.get("lib-1")).toBeUndefined();
  expect(await readCoverBlob("lib-1")).toBeNull();
});

import { coldCanonicalFixture } from "@/features/reader/canonical/fixtures/cold-payload";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests } from "../../../../db";
import { applyBookInfoPayload } from "../../book-info/write-book-info";
import { mergeListPayloadItemRow } from "../../collections/item-row";
import { bookToItemRow } from "../../collections/payload-rows";
import { applyBookContent } from "../../../book/storage";
import { DELETED_ITEM_PREFIX } from "../../deleted-items";
import { applyPdfMetadata } from "./storage";
import { book, edited } from "./test-fixture";
beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  await applyBookInfoPayload(book);
});
afterEach(() => __resetDbForTests());
it("older lists and details cannot revert a saved title, empty authors or cleared language", async () => {
  const db = getDb();
  expect(await applyPdfMetadata(db, edited)).toBe(true);
  for (const metadataEditVersion of [0, undefined]) {
    const stale = { ...book, metadataEditVersion };
    await db.libraryItems.put(
      mergeListPayloadItemRow(
        bookToItemRow({ ...stale, lastReadAt: "now" }, "now"),
        await db.libraryItems.get(book.libraryItemId),
      ),
    );
    await applyBookInfoPayload(stale);
    const row = await db.libraryItems.get(book.libraryItemId);
    expect(row).toMatchObject({
      title: edited.title,
      authors: [],
      metadataEditVersion: 1,
      details: { language: null },
    });
  }
  await applyBookInfoPayload({
    ...book,
    title: "Newer",
    metadataEditVersion: 2,
  });
  expect((await db.libraryItems.get(book.libraryItemId))?.title).toBe("Newer");
  expect(await applyPdfMetadata(db, edited)).toBe(false);
});
it("a late book download keeps edited display fields and the canonical package intact", async () => {
  const db = getDb();
  await applyPdfMetadata(db, edited);
  await applyBookContent({
    libraryItemId: book.libraryItemId,
    toc: [],
    chapterIds: [],
    metadata: {
      libraryItemId: book.libraryItemId,
      slug: book.slug,
      title: book.title,
      authors: book.authors,
      language: "en",
      primaryFormat: "PDF",
    },
  });
  expect((await db.books.get(book.libraryItemId))?.metadata).toMatchObject({
    title: edited.title,
    authors: [],
    language: null,
  });
  const before = await db.books.get(book.libraryItemId);
  const canonical = { readerPackage: coldCanonicalFixture().readerPackage };
  await db.books.put({ ...before!, canonical });
  await applyPdfMetadata(db, {
    ...edited,
    metadataEditVersion: 2,
    title: "Edited again",
  });
  expect((await db.books.get(book.libraryItemId))?.canonical).toEqual(
    canonical,
  );
});
it("foreign operation and deleted item responses cannot recreate or alter local content", async () => {
  const db = getDb();
  expect(await applyPdfMetadata(db, { ...edited, operationId: "other" })).toBe(
    false,
  );
  await db.meta.put({
    key: DELETED_ITEM_PREFIX + book.libraryItemId,
    value: true,
    updatedAt: "now",
  });
  expect(await applyPdfMetadata(db, edited)).toBe(false);
  expect((await db.libraryItems.get(book.libraryItemId))?.title).toBe(
    book.title,
  );
});

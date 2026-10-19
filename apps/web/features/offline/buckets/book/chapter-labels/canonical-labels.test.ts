import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { __resetDbForTests, getDb, setActiveUser } from "../../../db";
import { refreshDownloadedChapterLabels } from "./refresh-labels";
import { seedDownload, updated } from "./fixture";

beforeEach(() => {
  __resetDbForTests();
  setActiveUser("canonical-labels-test");
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

function canonicalCache() {
  const { readerPackage, resourceUrls } = canonicalFixture();
  return { readerPackage, resourceUrls };
}

it("does not fetch or modify immutable canonical downloads with legacy-looking labels", async () => {
  const db = await seedDownload();
  await db.books.update("book", { canonical: canonicalCache() });
  const book = await db.books.get("book");
  const chapters = await db.bookChapters.toArray();
  const fetchReader = vi.fn().mockResolvedValue(updated);
  await refreshDownloadedChapterLabels({
    userId: "canonical-labels-test",
    fetchReader,
  });
  expect(fetchReader).not.toHaveBeenCalled();
  expect(await db.books.get("book")).toEqual(book);
  expect(await db.bookChapters.toArray()).toEqual(chapters);
});

it("does not apply a legacy response after the cached content becomes canonical", async () => {
  const db = await seedDownload();
  let expected = await db.books.get("book");
  const fetchReader = vi.fn(async () => {
    await db.books.update("book", { canonical: canonicalCache() });
    expected = await db.books.get("book");
    return updated;
  });
  await refreshDownloadedChapterLabels({
    userId: "canonical-labels-test",
    fetchReader,
  });
  expect(fetchReader).toHaveBeenCalledOnce();
  expect(await db.books.get("book")).toEqual(expected);
});

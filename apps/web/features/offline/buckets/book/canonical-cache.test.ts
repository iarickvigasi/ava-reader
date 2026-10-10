import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { getDb, __resetDbForTests, setActiveUser } from "../../db";
import { coldCanonicalFixture } from "@/features/reader/canonical/fixtures/cold-payload";
import { canonicalChapters } from "@/features/reader/canonical/chapters";
import { readerLeaves, resolveJumpTarget } from "@/features/reader/jump-target";
import { applyBookContent, applyChapter } from "./storage";
import { loadReaderPayloadFromCache } from "./reader-cache";

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

async function seedCanonical() {
  const payload = coldCanonicalFixture();
  const book = payload.readerPackage!.book;
  const chapters = canonicalChapters(book, payload.resourceUrls!);
  await applyBookContent({
    libraryItemId: payload.book.libraryItemId,
    metadata: payload.book,
    toc: payload.toc,
    chapterIds: book.spine,
    canonical: {
      readerPackage: payload.readerPackage,
      resourceUrls: payload.resourceUrls,
    },
  });
  for (const chapter of chapters)
    await applyChapter({
      libraryItemId: payload.book.libraryItemId,
      chapterId: chapter.chapterId,
      index: chapter.spineIndex,
      blocks: chapter.blocks,
    });
  return payload;
}

it("round-trips fixed content, Unicode and a cold shared note without network", async () => {
  const original = await seedCanonical();
  const payload = await loadReaderPayloadFromCache(
    original.book.libraryItemId,
    "chapter-two",
  );
  if (payload?.status !== "READY") throw new Error("Missing cached reader");
  expect(payload.readerPackage).toEqual(original.readerPackage);
  expect(payload.resourceUrls).toEqual(original.resourceUrls);
  expect(payload.chapters.map((chapter) => chapter.chapterId)).toEqual([
    "extra-3",
    "chapter-two",
  ]);
  const chapter = payload.chapters.find(
    (item) => item.chapterId === "chapter-two",
  )!;
  expect(
    resolveJumpTarget(chapter, { blockId: "note-one", textOffset: 0 }),
  ).toMatchObject({ blockId: "note-one" });
  expect(
    readerLeaves(chapter.blocks).find((block) => block.id === "note-one")?.text,
  ).toContain("shared");
  expect(
    await loadReaderPayloadFromCache(original.book.libraryItemId, "unknown"),
  ).toBeNull();
});

it("does not read another account's accepted package", async () => {
  const original = await seedCanonical();
  const priorDb = getDb();
  setActiveUser("canonical-cache-other-account");
  await getDb().delete();
  await getDb().open();
  expect(
    await loadReaderPayloadFromCache(original.book.libraryItemId),
  ).toBeNull();
  await priorDb.delete();
});

it("does not claim an interrupted download is readable", async () => {
  const original = await seedCanonical();
  await getDb().bookChapters.delete([
    original.book.libraryItemId,
    "chapter-two",
  ]);
  expect(
    await loadReaderPayloadFromCache(
      original.book.libraryItemId,
      "chapter-two",
    ),
  ).toBeNull();
});

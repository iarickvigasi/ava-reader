import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb, setActiveUser } from "../../../db";
import { loadReaderPayloadFromCache } from "../reader-cache";
import { refreshDownloadedChapterLabels } from "./refresh-labels";
import { seedDownload, tocNode, updated } from "./fixture";
import { patchLegacyLabels } from "./patch-labels";

beforeEach(() => {
  __resetDbForTests();
  setActiveUser("heading-labels-test");
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("repairs an already-backfilled download, retries unchanged server data, and preserves user data", async () => {
  const db = await seedDownload();
  const cached = { ...tocNode, label: "1. Opening words…" };
  const source = { ...tocNode, label: "1 / Wanted: Men Who Love" };
  await db.books.update("book", { toc: [cached] });
  await db.bookChapters.update(["book", "chapter-1"], {
    blocks: [
      { id: "number", kind: "heading", level: 2, text: "1", inlines: [] },
      {
        id: "title",
        kind: "heading",
        level: 2,
        text: "Wanted: Men Who Love",
        inlines: [],
      },
      { id: "block-1", kind: "paragraph", text: "Opening words.", inlines: [] },
    ],
  });
  const chapters = await db.bookChapters.toArray();
  const pending = await db.preferenceMutations.toArray();
  const fetchReader = vi
    .fn()
    .mockResolvedValueOnce({ ...updated, toc: [cached] })
    .mockResolvedValue({ ...updated, toc: [source] });
  for (let i = 0; i < 3; i++)
    await refreshDownloadedChapterLabels({
      userId: "heading-labels-test",
      fetchReader,
    });
  expect(fetchReader).toHaveBeenCalledTimes(2);
  const payload = await loadReaderPayloadFromCache("book");
  expect(payload?.status === "READY" && payload.chapters[0].title).toBe(
    source.label,
  );
  expect(await db.bookChapters.toArray()).toEqual(chapters);
  expect(await db.preferenceMutations.toArray()).toEqual(pending);
});

it("requires the same TOC target and leaves authored nested labels alone", () => {
  const cached = { ...tocNode, label: "1. Opening words…" };
  const eligible = new Map([[cached.chapterId!, cached.label]]);
  const source = { ...tocNode, label: "1 / Wanted: Men Who Love" };
  expect(patchLegacyLabels([cached], [source], eligible)).toEqual([source]);
  expect(
    patchLegacyLabels(
      [cached],
      [{ ...source, anchorId: "different" }],
      eligible,
    ),
  ).toBeNull();
  expect(patchLegacyLabels([cached], [source])).toBeNull();
  expect(
    patchLegacyLabels(
      [{ ...cached, label: "Authored title…" }],
      [source],
      eligible,
    ),
  ).toBeNull();
});

it("does not refetch untitled excerpts with no opening heading", async () => {
  const db = await seedDownload();
  await db.books.update("book", { toc: updated.toc });
  const fetchReader = vi.fn();
  await refreshDownloadedChapterLabels({
    userId: "heading-labels-test",
    fetchReader,
  });
  expect(fetchReader).not.toHaveBeenCalled();
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb, setActiveUser } from "../../../db";
import { loadReaderPayloadFromCache } from "../reader-cache";
import { refreshDownloadedChapterLabels } from "./refresh-labels";
import { seedDownload, tocNode, updated } from "./fixture";

beforeEach(() => {
  __resetDbForTests();
  setActiveUser("labels-test");
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("persists labels and cached payload titles without touching content or pending edits", async () => {
  const db = await seedDownload();
  const chapters = await db.bookChapters.toArray();
  const mutations = await db.preferenceMutations.toArray();
  const fetchReader = vi.fn().mockResolvedValue(updated);
  await refreshDownloadedChapterLabels({ userId: "labels-test", fetchReader });
  expect(await db.books.get("book")).toMatchObject({
    fetchedAt: "original",
    toc: updated.toc,
  });
  expect(await db.bookChapters.toArray()).toEqual(chapters);
  expect(await db.preferenceMutations.toArray()).toEqual(mutations);
  const payload = await loadReaderPayloadFromCache("book");
  expect(payload?.status === "READY" && payload.chapters[0].label).toBe(
    "1. Opening words…",
  );
  await refreshDownloadedChapterLabels({ userId: "labels-test", fetchReader });
  expect(fetchReader).toHaveBeenCalledTimes(1);
});

it("retries unavailable or not-yet-backfilled labels", async () => {
  const db = await seedDownload();
  const fetchReader = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ...updated, toc: [tocNode] })
    .mockResolvedValue(updated);
  for (let i = 0; i < 3; i++) {
    await refreshDownloadedChapterLabels({
      userId: "labels-test",
      fetchReader,
    });
  }
  expect(fetchReader).toHaveBeenCalledTimes(3);
  expect(await db.books.get("book")).toMatchObject({ toc: updated.toc });
});

it("does not restore a download removed during the request", async () => {
  const db = await seedDownload();
  await refreshDownloadedChapterLabels({
    userId: "labels-test",
    fetchReader: async () => {
      await db.books.delete("book");
      return updated;
    },
  });
  expect(await db.books.get("book")).toBeUndefined();
});

it("deduplicates concurrent passes and fences deletion tombstones", async () => {
  const db = await seedDownload();
  const fetchReader = vi.fn(async () => {
    await db.meta.put({
      key: "deleted-library-item:book",
      value: true,
      updatedAt: "now",
    });
    return updated;
  });
  await Promise.all(
    [1, 2].map(() =>
      refreshDownloadedChapterLabels({ userId: "labels-test", fetchReader }),
    ),
  );
  expect(fetchReader).toHaveBeenCalledTimes(1);
  expect(await db.books.get("book")).toMatchObject({ toc: [tocNode] });
});

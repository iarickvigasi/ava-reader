import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb, setActiveUser } from "../../../db";
import { loadReaderPayloadFromCache } from "../reader-cache";
import { refreshDownloadedChapterLabels } from "./refresh-labels";
import { seedDownload, tocNode, updated } from "./fixture";

afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it("updates an older offline contents label and header, then skips the repaired download", async () => {
  __resetDbForTests();
  setActiveUser("encoded-labels-test");
  const db = await seedDownload();
  const cached = { ...tocNode, label: "The Parable of the Cow&#x2019;s Tail" };
  const readable = "The Parable of the Cow’s Tail";
  await db.books.update("book", { toc: [cached] });
  const blocks = await db.bookChapters.toArray();
  const pending = await db.preferenceMutations.toArray();
  const fetchReader = vi
    .fn()
    .mockResolvedValueOnce({ ...updated, toc: [cached] })
    .mockResolvedValue({ ...updated, toc: [{ ...tocNode, label: readable }] });
  for (let i = 0; i < 3; i++) {
    await refreshDownloadedChapterLabels({
      userId: "encoded-labels-test",
      fetchReader,
    });
  }
  expect(fetchReader).toHaveBeenCalledTimes(2);
  const payload = await loadReaderPayloadFromCache("book");
  expect(payload?.status).toBe("READY");
  if (payload?.status !== "READY") throw new Error("Expected cached reader");
  expect(payload.toc[0].label).toBe(readable);
  expect(payload.chapters[0].label).toBe(readable);
  expect(payload.chapters[0].title).toBe(readable);
  expect(await db.bookChapters.toArray()).toEqual(blocks);
  expect(await db.preferenceMutations.toArray()).toEqual(pending);
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { __resetDbForTests, getDb, setActiveUser } from "../../../db";
import { refreshDownloadedChapterLabels } from "./refresh-labels";
import { seedDownload, tocNode, updated } from "./fixture";

beforeEach(() => {
  __resetDbForTests();
  setActiveUser("combined-labels");
});
afterEach(async () => {
  await getDb().delete();
  __resetDbForTests();
});

it.each(["9", "1. 9…", "The Spies", "006-chapter01.html"])(
  "refreshes partial or excerpt label %s",
  async (label) => {
    const db = await seedDownload();
    await db.books.update("book", { toc: [{ ...tocNode, label }] });
    await db.bookChapters.update(["book", "chapter-1"], {
      blocks: [
        {
          id: "number",
          kind: "paragraph",
          text: "9",
          inlines: [],
          align: "center",
          fontSizeScale: 1.375,
        },
        {
          id: "title",
          kind: "paragraph",
          text: "The Spies",
          inlines: [],
          align: "center",
          fontSizeScale: 1.375,
        },
      ],
    });
    const blocks = await db.bookChapters.toArray();
    const source = { ...tocNode, label: "9 / The Spies" };
    const fetchReader = vi
      .fn()
      .mockResolvedValue({ ...updated, toc: [source] });
    for (let i = 0; i < 2; i++)
      await refreshDownloadedChapterLabels({
        userId: "combined-labels",
        fetchReader,
      });
    expect(fetchReader).toHaveBeenCalledTimes(1);
    expect((await db.books.get("book"))?.toc).toEqual([source]);
    expect(await db.bookChapters.toArray()).toEqual(blocks);
  },
);

it("refreshes a number-only image divider from server labels", async () => {
  const db = await seedDownload();
  await db.books.update("book", { toc: [{ ...tocNode, label: "1." }] });
  await db.bookChapters.update(["book", "chapter-1"], {
    blocks: [
      {
        id: "image",
        kind: "image",
        text: "part one",
        alt: "part one",
        src: "image",
      },
    ],
  });
  const source = { ...tocNode, label: "1. Four years ago, married to the…" };
  const fetchReader = vi.fn().mockResolvedValue({ ...updated, toc: [source] });
  await refreshDownloadedChapterLabels({
    userId: "combined-labels",
    fetchReader,
  });
  expect((await db.books.get("book"))?.toc).toEqual([source]);
});

import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DB_NAME, __resetDbForTests, getDb } from "../../db";
import { applyLibraryPayload } from "./collections/write-library";
import { deleteBook } from "./delete-book";
import { cachedLibraryItemIds } from "./remove-cached-items";
import { payload } from "./test-fixture";

vi.mock("@/lib/api", () => ({
  getPublicApiBaseUrl: () => "http://localhost:4000",
}));

beforeEach(async () => {
  __resetDbForTests();
  await Dexie.delete(DB_NAME);
  await applyLibraryPayload(payload());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  __resetDbForTests();
});

it.each(["translations", "highlightMutations", "aiCommentMutations"])(
  "completes deletion and refresh when Safari rejects unique cursors on empty %s",
  async (store) => {
    expect(await getDb().table(store).count()).toBe(0);
    const openKeyCursor = IDBIndex.prototype.openKeyCursor;
    vi.spyOn(IDBIndex.prototype, "openKeyCursor").mockImplementation(function (
      this: IDBIndex,
      query,
      direction,
    ) {
      if (this.objectStore.name === store && direction === "nextunique") {
        throw new DOMException("Unable to open cursor", "UnknownError");
      }
      return openKeyCursor.call(this, query, direction);
    });
    const refreshed = payload();
    refreshed.libraryItemIds = ["lib-1"];
    refreshed.summary.booksCount = 1;
    refreshed.collections[0].books = refreshed.collections[0].books.slice(0, 1);
    refreshed.collections[0].itemCount = 1;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json(refreshed))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      deleteBook("lib-2", async () => "token"),
    ).resolves.toBeUndefined();

    expect(await getDb().libraryItems.get("lib-2")).toBeUndefined();
    expect(await getDb().libraryItems.get("lib-1")).toBeDefined();
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://localhost:4000/api/library/lib-2",
      "http://localhost:4000/api/library",
      "http://localhost:4000/api/home",
    ]);
  },
);

it("deduplicates repeated index keys while retaining orphaned book identities", async () => {
  const db = getDb();
  await db.bookChapters.bulkPut(
    ["first", "second"].map((chapterId, index) => ({
      libraryItemId: "orphan",
      chapterId,
      index,
      blocks: [],
      aux: null,
      fetchedAt: "now",
    })),
  );
  expect((await cachedLibraryItemIds(db)).sort()).toEqual([
    "lib-1",
    "lib-2",
    "orphan",
  ]);
});

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DB_NAME,
  __resetDbForTests,
  getDb,
  type LibraryItemRow,
} from "../../db";
import {
  applyBookContent,
  applyChapter,
  attachCoverBlob,
  deleteBookContent,
  findPreviousAutoSavedId,
  hasBookContent,
  markBookSaved,
  readBookContent,
  readCachedChapterIds,
  readChapter,
  readOfflineState,
} from "./storage";

function seedLibraryItem(
  overrides: Partial<LibraryItemRow> & { libraryItemId: string },
): LibraryItemRow {
  return {
    libraryItemId: overrides.libraryItemId,
    slug: overrides.slug ?? `slug-${overrides.libraryItemId}`,
    title: overrides.title ?? "Title",
    authors: overrides.authors ?? [],
    coverImageUrl: overrides.coverImageUrl ?? null,
    completionPercent: overrides.completionPercent ?? 0,
    primaryFormat: overrides.primaryFormat ?? "EPUB",
    lastReadAt: overrides.lastReadAt ?? null,
    coverBlob: overrides.coverBlob ?? null,
    savedOffline: overrides.savedOffline ?? false,
    savedAutomatically: overrides.savedAutomatically ?? false,
    savedAt: overrides.savedAt ?? null,
    serverUpdatedAt: overrides.serverUpdatedAt ?? null,
    details: overrides.details,
    detailsFetchedAt: overrides.detailsFetchedAt,
  };
}

beforeEach(() => {
  __resetDbForTests();
});

afterEach(async () => {
  __resetDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

describe("book bucket storage", () => {
  it("round-trips book content and chapters", async () => {
    await applyBookContent({
      libraryItemId: "lib-1",
      toc: [],
      chapterIds: ["ch-1", "ch-2"],
      metadata: {
        libraryItemId: "lib-1",
        slug: "book-a",
        title: "Book A",
        authors: ["A"],
        primaryFormat: "EPUB",
      },
    });
    await applyChapter({
      libraryItemId: "lib-1",
      chapterId: "ch-1",
      index: 0,
      blocks: [{ kind: "paragraph", id: "p1", inlines: [], text: "Hi" }],
    });

    const book = await readBookContent("lib-1");
    expect(book?.chapterIds).toEqual(["ch-1", "ch-2"]);
    const chapter = await readChapter("lib-1", "ch-1");
    expect(chapter?.blocks).toHaveLength(1);
  });

  it("readCachedChapterIds returns only the requested book's chapters", async () => {
    await applyChapter({
      libraryItemId: "lib-1",
      chapterId: "ch-1",
      index: 0,
      blocks: [],
    });
    await applyChapter({
      libraryItemId: "lib-1",
      chapterId: "ch-2",
      index: 1,
      blocks: [],
    });
    await applyChapter({
      libraryItemId: "lib-2",
      chapterId: "ch-1",
      index: 0,
      blocks: [],
    });

    const lib1 = await readCachedChapterIds("lib-1");
    expect(Array.from(lib1).sort()).toEqual(["ch-1", "ch-2"]);
    const lib2 = await readCachedChapterIds("lib-2");
    expect(Array.from(lib2)).toEqual(["ch-1"]);
  });

  it("deleteBookContent clears book + chapters + cover + flags", async () => {
    const db = getDb();
    await db.libraryItems.put(
      seedLibraryItem({
        libraryItemId: "lib-1",
        savedOffline: true,
        savedAutomatically: true,
        savedAt: "2026-01-01T00:00:00Z",
        coverBlob: new Blob(["cover"], { type: "image/png" }),
      }),
    );
    await applyBookContent({
      libraryItemId: "lib-1",
      toc: [],
      chapterIds: ["ch-1"],
      metadata: {
        libraryItemId: "lib-1",
        slug: "book-a",
        title: "Book A",
        authors: [],
        primaryFormat: "EPUB",
      },
    });
    await applyChapter({
      libraryItemId: "lib-1",
      chapterId: "ch-1",
      index: 0,
      blocks: [],
    });

    await deleteBookContent("lib-1");

    expect(await readBookContent("lib-1")).toBeUndefined();
    expect(await readChapter("lib-1", "ch-1")).toBeUndefined();
    const row = await db.libraryItems.get("lib-1");
    expect(row?.coverBlob).toBeNull();
    expect(row?.savedOffline).toBe(false);
    expect(row?.savedAutomatically).toBe(false);
    expect(row?.savedAt).toBeNull();
  });

  it("markBookSaved sets the right flag combination", async () => {
    const db = getDb();
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "lib-1" }));
    await markBookSaved("lib-1", "auto");
    let row = await db.libraryItems.get("lib-1");
    expect(row?.savedAutomatically).toBe(true);
    expect(row?.savedOffline).toBe(false);

    await markBookSaved("lib-1", "explicit");
    row = await db.libraryItems.get("lib-1");
    expect(row?.savedAutomatically).toBe(true); // promotion keeps auto bit
    expect(row?.savedOffline).toBe(true);
  });

  it("attachCoverBlob updates the row's blob", async () => {
    const db = getDb();
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "lib-1" }));
    const blob = new Blob(["cover"], { type: "image/png" });
    await attachCoverBlob("lib-1", blob);
    const row = await db.libraryItems.get("lib-1");
    expect(row?.coverBlob).toBeInstanceOf(Blob);
  });

  it("findPreviousAutoSavedId returns only auto-only rows other than the exception", async () => {
    const db = getDb();
    await db.libraryItems.bulkPut([
      seedLibraryItem({
        libraryItemId: "auto-prev",
        savedAutomatically: true,
        savedOffline: false,
      }),
      seedLibraryItem({
        libraryItemId: "explicit",
        savedAutomatically: false,
        savedOffline: true,
      }),
      seedLibraryItem({
        libraryItemId: "auto-promoted",
        // promoted: counts as explicit, must not be picked
        savedAutomatically: true,
        savedOffline: true,
      }),
      seedLibraryItem({
        libraryItemId: "current",
        savedAutomatically: true,
        savedOffline: false,
      }),
    ]);

    const result = await findPreviousAutoSavedId("current");
    expect(result).toBe("auto-prev");
  });

  it("hasBookContent is true only when both BookRow and the first chapter exist", async () => {
    await applyBookContent({
      libraryItemId: "lib-1",
      toc: [],
      chapterIds: ["ch-1"],
      metadata: {
        libraryItemId: "lib-1",
        slug: "book-a",
        title: "Book A",
        authors: [],
        primaryFormat: "EPUB",
      },
    });
    // BookRow exists but no chapters yet — partial state shouldn't count
    // as "ready offline".
    expect(await hasBookContent("lib-1")).toBe(false);

    await applyChapter({
      libraryItemId: "lib-1",
      chapterId: "ch-1",
      index: 0,
      blocks: [],
    });
    expect(await hasBookContent("lib-1")).toBe(true);
  });

  it("readOfflineState distinguishes absent / auto / explicit + origin", async () => {
    const db = getDb();
    // Not cached.
    expect(await readOfflineState("lib-1")).toEqual({
      state: "absent",
      fromAutoSave: false,
    });

    // Cache content + an auto-saved library row → "auto".
    await applyBookContent({
      libraryItemId: "lib-1",
      toc: [],
      chapterIds: ["ch-1"],
      metadata: {
        libraryItemId: "lib-1",
        slug: "book-a",
        title: "Book A",
        authors: ["A"],
        primaryFormat: "EPUB",
      },
    });
    await applyChapter({
      libraryItemId: "lib-1",
      chapterId: "ch-1",
      index: 0,
      blocks: [],
    });
    await db.libraryItems.put(
      seedLibraryItem({
        libraryItemId: "lib-1",
        savedOffline: false,
        savedAutomatically: true,
      }),
    );
    expect(await readOfflineState("lib-1")).toEqual({
      state: "auto",
      fromAutoSave: true,
    });

    // Explicit save that originated from an auto-save (kept) → fromAutoSave true.
    await db.libraryItems.put(
      seedLibraryItem({
        libraryItemId: "lib-1",
        savedOffline: true,
        savedAutomatically: true,
      }),
    );
    expect(await readOfflineState("lib-1")).toEqual({
      state: "explicit",
      fromAutoSave: true,
    });

    // Explicit save downloaded from scratch (never auto) → fromAutoSave false.
    await db.libraryItems.put(
      seedLibraryItem({
        libraryItemId: "lib-1",
        savedOffline: true,
        savedAutomatically: false,
      }),
    );
    expect(await readOfflineState("lib-1")).toEqual({
      state: "explicit",
      fromAutoSave: false,
    });
  });
});

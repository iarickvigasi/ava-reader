import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ReaderBookPayload,
  ReaderChapterPayload,
  ReaderStatusPayload,
  ReaderTocNode,
} from "@/lib/api-types/reader";

import {
  DB_NAME,
  __resetDbForTests,
  getDb,
  type LibraryItemRow,
} from "../../db";
import { __resetBookBucketForTests, getBookSaveSnapshot } from "./bucket";
import {
  pickStrideTargets,
  saveBookOffline,
  type ChapterFetcher,
} from "./download";
import { hasBookContent, readBookContent, readChapter } from "./storage";

// ----- fixtures --------------------------------------------------------------

function bookMetadata(libraryItemId: string): ReaderBookPayload {
  return {
    libraryItemId,
    slug: `slug-${libraryItemId}`,
    title: `Title ${libraryItemId}`,
    authors: ["Author"],
    primaryFormat: "EPUB",
  };
}

function tocFromIds(ids: string[]): ReaderTocNode[] {
  return ids.map((id, index) => ({
    id: `toc-${id}`,
    label: `Chapter ${index + 1}`,
    chapterId: id,
    blockId: null,
    anchorId: null,
    href: null,
    spineIndex: index,
    children: [],
  }));
}

function chapterPayload(
  chapterId: string,
  ids: string[],
): ReaderChapterPayload {
  const i = ids.indexOf(chapterId);
  return {
    chapterId,
    blocks: [
      {
        kind: "paragraph",
        id: `block-${chapterId}`,
        inlines: [],
        text: `content of ${chapterId}`,
      },
    ],
    href: `#${chapterId}`,
    label: chapterId,
    title: chapterId,
    nextChapterId: ids[i + 1] ?? null,
    previousChapterId: ids[i - 1] ?? null,
    spineIndex: i,
  };
}

// Builds a fake ChapterFetcher that returns a 3-chapter window around the
// requested chapter id. When no id is passed, it returns the first chapter
// and its window plus the full TOC (mirrors the real reader behaviour).
function buildFetcher(
  libraryItemId: string,
  chapterIds: string[],
  options: { onCall?: (chapterId: string | undefined) => void } = {},
): ChapterFetcher {
  return async (id, chapterId) => {
    if (id !== libraryItemId) {
      throw new Error(`unexpected libraryItemId: ${id}`);
    }
    options.onCall?.(chapterId);
    const focus =
      chapterId && chapterIds.includes(chapterId)
        ? chapterId
        : chapterIds[0]!;
    const focusIndex = chapterIds.indexOf(focus);
    const windowIds = [
      chapterIds[focusIndex - 1],
      chapterIds[focusIndex],
      chapterIds[focusIndex + 1],
    ].filter((x): x is string => !!x);
    const payload: ReaderStatusPayload = {
      status: "READY",
      activeChapterId: focus,
      toc: tocFromIds(chapterIds),
      book: bookMetadata(libraryItemId),
      chapters: windowIds.map((id) => chapterPayload(id, chapterIds)),
      progress: {
        chapterLabel: focus,
        completionPercent: 0,
        lastReadAt: null,
        locator: null,
      },
    };
    return payload;
  };
}

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
  };
}

// ----- lifecycle -------------------------------------------------------------

beforeEach(() => {
  __resetDbForTests();
  __resetBookBucketForTests();
});

afterEach(async () => {
  __resetDbForTests();
  __resetBookBucketForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

// ----- happy paths -----------------------------------------------------------

describe("saveBookOffline — happy path", () => {
  it("saves every chapter listed in the TOC and flips the saved flags", async () => {
    const db = getDb();
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "lib-1" }));

    const ids = ["ch-1", "ch-2", "ch-3", "ch-4", "ch-5"];
    const fetcher = buildFetcher("lib-1", ids);

    const outcome = await saveBookOffline({
      libraryItemId: "lib-1",
      saveKind: "explicit",
      fetchChapter: fetcher,
    });

    expect(outcome).toEqual({ kind: "saved" });
    expect(await hasBookContent("lib-1")).toBe(true);
    for (const id of ids) {
      const chapter = await readChapter("lib-1", id);
      expect(chapter, `chapter ${id} should be cached`).toBeDefined();
    }
    const book = await readBookContent("lib-1");
    expect(book?.chapterIds).toEqual(ids);
    const row = await db.libraryItems.get("lib-1");
    expect(row?.savedOffline).toBe(true);
    expect(getBookSaveSnapshot("lib-1").status).toBe("saved");
    expect(getBookSaveSnapshot("lib-1").currentChapters).toBe(ids.length);
  });

  it("uses stride-3 scheduling — no duplicate chapter fetches", async () => {
    const db = getDb();
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "lib-1" }));
    // 9 chapters → discovery covers ch-1..ch-2 (first window), then anchors
    // at ch-4 and ch-7 cover ch-3..ch-5 and ch-6..ch-8, then the final
    // anchor (last id) covers ch-9. Total fetches: 4 (1 discovery + 3 anchors).
    const ids = [
      "ch-1",
      "ch-2",
      "ch-3",
      "ch-4",
      "ch-5",
      "ch-6",
      "ch-7",
      "ch-8",
      "ch-9",
    ];
    const calls: (string | undefined)[] = [];
    const fetcher = buildFetcher("lib-1", ids, {
      onCall: (id) => calls.push(id),
    });

    await saveBookOffline({
      libraryItemId: "lib-1",
      saveKind: "explicit",
      fetchChapter: fetcher,
      concurrency: 3,
    });

    expect(calls[0]).toBeUndefined();
    // Strictly less than chapter count (no duplicates) and bounded by the
    // stride-3 plan: 1 discovery + ceil(N/3) anchors at most.
    expect(calls.length).toBeLessThanOrEqual(1 + Math.ceil(ids.length / 3));
    // No id is fetched twice (other than the initial undefined).
    const fetchedIds = calls.filter((c): c is string => !!c);
    expect(new Set(fetchedIds).size).toBe(fetchedIds.length);
  });
});

describe("pickStrideTargets", () => {
  it("returns empty when everything is covered", () => {
    const ids = ["a", "b", "c"];
    expect(pickStrideTargets(ids, new Set(ids))).toEqual([]);
  });

  it("returns indices 1, 4, 7, … and the last id for full coverage", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    // Anchors at b (1), e (4), h (7); last is i — already covered by h's
    // ±1 window, so it shouldn't be re-added.
    expect(pickStrideTargets(ids, new Set())).toEqual(["b", "e", "h"]);
  });

  it("appends the last chapter when its slice is not yet covered by stride", () => {
    // 4 chapters → stride anchors at index 1 (b) covers a/b/c. d is left
    // uncovered, so it gets appended.
    const ids = ["a", "b", "c", "d"];
    expect(pickStrideTargets(ids, new Set())).toEqual(["b", "d"]);
  });

  it("skips anchors whose window is already entirely on disk", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    // a, b, c already on disk. First anchor (b) has all neighbours covered,
    // skip. Second anchor (e) covers d/e/f — keep.
    expect(pickStrideTargets(ids, new Set(["a", "b", "c"]))).toEqual(["e"]);
  });

  it("handles a single-chapter book", () => {
    expect(pickStrideTargets(["only"], new Set())).toEqual(["only"]);
    expect(pickStrideTargets(["only"], new Set(["only"]))).toEqual([]);
  });
});

// ----- eviction --------------------------------------------------------------

describe("saveBookOffline — eviction policy", () => {
  it("drops the previous auto-saved book after a successful new auto-save", async () => {
    const db = getDb();
    // Pre-existing auto-saved book.
    await db.libraryItems.put(
      seedLibraryItem({
        libraryItemId: "old-auto",
        savedAutomatically: true,
        savedAt: "2026-01-01T00:00:00Z",
      }),
    );
    // Pre-seed its content so we can verify deletion.
    await db.books.put({
      libraryItemId: "old-auto",
      toc: [],
      chapterIds: ["ch-1"],
      metadata: bookMetadata("old-auto"),
      fetchedAt: "2026-01-01T00:00:00Z",
    });
    await db.bookChapters.put({
      libraryItemId: "old-auto",
      chapterId: "ch-1",
      index: 0,
      blocks: [],
      aux: null,
      fetchedAt: "2026-01-01T00:00:00Z",
    });

    // New book, also auto-save.
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "new-auto" }));
    const fetcher = buildFetcher("new-auto", ["ch-a", "ch-b"]);

    await saveBookOffline({
      libraryItemId: "new-auto",
      saveKind: "auto",
      fetchChapter: fetcher,
    });

    // Old auto-saved book is gone.
    expect(await readBookContent("old-auto")).toBeUndefined();
    expect(await readChapter("old-auto", "ch-1")).toBeUndefined();
    const oldRow = await db.libraryItems.get("old-auto");
    expect(oldRow?.savedAutomatically).toBe(false);
    // New auto book is saved.
    expect(await hasBookContent("new-auto")).toBe(true);
  });

  it("never evicts an explicitly-saved book", async () => {
    const db = getDb();
    await db.libraryItems.put(
      seedLibraryItem({
        libraryItemId: "explicit",
        savedAutomatically: false,
        savedOffline: true,
      }),
    );
    await db.books.put({
      libraryItemId: "explicit",
      toc: [],
      chapterIds: ["ch-1"],
      metadata: bookMetadata("explicit"),
      fetchedAt: "2026-01-01T00:00:00Z",
    });

    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "new-auto" }));
    const fetcher = buildFetcher("new-auto", ["ch-a"]);

    await saveBookOffline({
      libraryItemId: "new-auto",
      saveKind: "auto",
      fetchChapter: fetcher,
    });

    // The explicit book is untouched.
    expect(await readBookContent("explicit")).toBeDefined();
  });

  it("an explicit save does not evict anything", async () => {
    const db = getDb();
    await db.libraryItems.put(
      seedLibraryItem({
        libraryItemId: "old-auto",
        savedAutomatically: true,
      }),
    );
    await db.books.put({
      libraryItemId: "old-auto",
      toc: [],
      chapterIds: [],
      metadata: bookMetadata("old-auto"),
      fetchedAt: "2026-01-01T00:00:00Z",
    });
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "new" }));
    const fetcher = buildFetcher("new", ["ch-a"]);

    await saveBookOffline({
      libraryItemId: "new",
      saveKind: "explicit",
      fetchChapter: fetcher,
    });

    expect(await readBookContent("old-auto")).toBeDefined();
  });
});

// ----- cancellation ----------------------------------------------------------

describe("saveBookOffline — cancellation", () => {
  it("aborting mid-flight cleans up partial rows and returns cancelled", async () => {
    const db = getDb();
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "lib-1" }));
    const ids = ["ch-1", "ch-2", "ch-3", "ch-4", "ch-5"];
    const controller = new AbortController();

    let fetchCount = 0;
    const fetcher: ChapterFetcher = async (id, chapterId, signal) => {
      fetchCount += 1;
      if (fetchCount === 2) {
        // After the initial fetch, abort during the second one. Throw the
        // AbortError synchronously after firing abort so the orchestrator
        // sees the same signal a real fetch would after a network cancel.
        controller.abort();
        throw new DOMException("Aborted", "AbortError");
      }
      return buildFetcher(id, ids)(id, chapterId, signal);
    };

    const outcome = await saveBookOffline({
      libraryItemId: "lib-1",
      saveKind: "explicit",
      fetchChapter: fetcher,
      signal: controller.signal,
    });

    expect(outcome).toEqual({ kind: "cancelled" });
    // Partial rows cleaned up.
    expect(await readBookContent("lib-1")).toBeUndefined();
    const remaining = await db.bookChapters
      .where("[libraryItemId+chapterId]")
      .between(["lib-1", ""], ["lib-1", "￿"])
      .count();
    expect(remaining).toBe(0);
    const row = await db.libraryItems.get("lib-1");
    expect(row?.savedOffline).toBe(false);
    expect(row?.savedAutomatically).toBe(false);
  });
});

// ----- failure --------------------------------------------------------------

describe("saveBookOffline — failure path", () => {
  it("cleans up + records failed status on fetch errors", async () => {
    const db = getDb();
    await db.libraryItems.put(seedLibraryItem({ libraryItemId: "lib-1" }));
    const fetcher: ChapterFetcher = async () => {
      throw new Error("network is down");
    };

    const outcome = await saveBookOffline({
      libraryItemId: "lib-1",
      saveKind: "explicit",
      fetchChapter: fetcher,
    });

    expect(outcome.kind).toBe("failed");
    expect(getBookSaveSnapshot("lib-1").status).toBe("failed");
    expect(await readBookContent("lib-1")).toBeUndefined();
  });
});

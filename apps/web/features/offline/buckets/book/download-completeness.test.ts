import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { canonicalFixture } from "@/features/reader/canonical/fixtures/payload";
import { __resetDbForTests, getDb, setActiveUser } from "../../db";
import {
  __resetBookBucketForTests,
  getBookSaveSnapshot,
  abortInFlightExcept,
} from "./bucket";
import { saveBookOffline } from "./download";
import { applyBookContent, applyChapter, hasBookContent } from "./storage";
import { loadReaderPayloadFromCache } from "./reader-cache";
import { pdfStatus } from "../library/pdf-imports/test-fixture";
import { recordDownloadCoverage } from "./download-coverage";
import {
  clearDownloadCoverage,
  readDownloadCoverage,
} from "./download-coverage";
import { DELETED_ITEM_PREFIX } from "../library/deleted-items";

type Ready = Extract<ReaderStatusPayload, { status: "READY" }>;
const itemId = "completeness-book";
function payload(ids = ["one"], libraryItemId = itemId): Ready {
  return {
    status: "READY",
    chapterIds: ["one", "two", "three"],
    contentRevision: "1".repeat(64),
    book: {
      libraryItemId,
      slug: libraryItemId,
      title: "Test",
      authors: [],
      language: "en",
      primaryFormat: "EPUB",
    },
    activeChapterId: ids[0],
    chapters: ids.map((chapterId) => ({
      chapterId,
      blocks: [],
      href: chapterId,
      label: chapterId,
      title: chapterId,
      spineIndex: 0,
      previousChapterId: null,
      nextChapterId: null,
    })),
    toc: ["one", "two", "three"].map((chapterId, spineIndex) => ({
      id: chapterId,
      chapterId,
      spineIndex,
      label: chapterId,
      children: [],
      href: null,
      anchorId: null,
      blockId: null,
    })),
    progress: {
      chapterLabel: null,
      completionPercent: 0,
      lastReadAt: null,
      locator: null,
    },
  };
}
async function seedItem(initial: Ready) {
  await getDb().libraryItems.put({
    ...initial.book,
    coverImageUrl: null,
    completionPercent: 0,
    lastReadAt: null,
    coverBlob: null,
    savedOffline: false,
    savedAutomatically: false,
    savedAt: null,
    offlineRequested: true,
    serverUpdatedAt: null,
  });
}

beforeEach(async () => {
  __resetDbForTests();
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
});
afterEach(async () => {
  await getDb().delete();
  setActiveUser("offline-completeness-owner");
  await getDb().delete();
  __resetDbForTests();
  __resetBookBucketForTests();
});

it.each(["PROCESSING", "FAILED", "UNSUPPORTED"] as const)(
  "fails when a later chapter response is %s",
  async (status) => {
    const initial = payload();
    const result = await saveBookOffline({
      libraryItemId: itemId,
      saveKind: "explicit",
      fetchChapter: async (_, id) =>
        id
          ? {
              status,
              book: initial.book,
              progress: initial.progress,
              message: "Unavailable",
            }
          : initial,
    });
    expect(result.kind).toBe("failed");
    expect(getBookSaveSnapshot(itemId).status).toBe("failed");
    expect(await hasBookContent(itemId)).toBe(false);
    expect(await loadReaderPayloadFromCache(itemId, "one")).toBeNull();
  },
);

it("rejects a READY response that omits the requested chapter instead of declaring a partial book saved", async () => {
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async () => payload(),
  });
  expect(result.kind).toBe("failed");
  expect(getBookSaveSnapshot(itemId).status).toBe("failed");
  expect(await hasBookContent(itemId)).toBe(false);
});

it("rejects a response belonging to another library item before writing its chapters", async () => {
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async () => payload(["one"], "other-book"),
  });
  expect(result.kind).toBe("failed");
  expect(await getDb().bookChapters.count()).toBe(0);
});

it("keeps confirmed chapters on a network failure and fetches only missing chapters on the next run", async () => {
  await seedItem(payload());
  await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      if (id) throw new Error("network interrupted");
      return payload();
    },
  });
  expect(await getDb().bookChapters.get([itemId, "one"])).toBeDefined();
  expect(await hasBookContent(itemId)).toBe(false);
  expect(await getDb().libraryItems.get(itemId)).toMatchObject({
    offlineRequested: true,
    savedOffline: false,
  });
  const calls: Array<string | undefined> = [];
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      calls.push(id);
      return payload(id ? [id] : ["one"]);
    },
  });
  expect(result).toEqual({ kind: "saved" });
  expect(calls).toEqual([undefined, "two", "three"]);
  expect(await hasBookContent(itemId)).toBe(true);
  expect(await getDb().libraryItems.get(itemId)).toMatchObject({
    offlineRequested: true,
    savedOffline: true,
  });
});

it("does not write a late response or cleanup into the next account's book", async () => {
  const initial = payload();
  let release!: (value: ReaderStatusPayload) => void;
  let started!: () => void;
  const pending = new Promise<ReaderStatusPayload>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const running = saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      if (!id) return initial;
      started();
      return pending;
    },
  });
  await requested;
  setActiveUser("offline-completeness-owner");
  await getDb().delete();
  await getDb().open();
  await applyBookContent({
    libraryItemId: itemId,
    metadata: initial.book,
    toc: [],
    chapterIds: ["other-account-chapter"],
  });
  await applyChapter({
    libraryItemId: itemId,
    chapterId: "other-account-chapter",
    index: 0,
    blocks: [],
  });
  await getDb().books.update(itemId, { contentRevision: "2".repeat(64) });
  await recordDownloadCoverage(getDb(), itemId, `epub:${"2".repeat(64)}`, [
    "other-account-chapter",
  ]);
  release(payload(["two", "three"]));
  expect(await running).toEqual({ kind: "cancelled" });
  expect(await getDb().bookChapters.toArray()).toMatchObject([
    { chapterId: "other-account-chapter" },
  ]);
  expect(await hasBookContent(itemId)).toBe(true);
});

it("does not report a cached book complete when a later expected chapter is absent", async () => {
  const initial = payload();
  await applyBookContent({
    libraryItemId: itemId,
    metadata: initial.book,
    toc: initial.toc,
    chapterIds: ["one", "two"],
  });
  await applyChapter({
    libraryItemId: itemId,
    chapterId: "one",
    index: 0,
    blocks: [],
  });
  expect(await hasBookContent(itemId)).toBe(false);
  expect((await loadReaderPayloadFromCache(itemId, "one"))?.status).toBe(
    "READY",
  );
  expect(await loadReaderPayloadFromCache(itemId, "two")).toBeNull();
});

it("does not report a canonical cache complete when required illustration bytes are absent", async () => {
  const initial = canonicalFixture();
  const libraryItemId = initial.book.libraryItemId;
  await saveBookOffline({
    libraryItemId,
    saveKind: "explicit",
    fetchChapter: async () => initial,
  });
  const book = (await getDb().books.get(libraryItemId))!;
  book.canonical!.resourceUrls = { "image-one": "" };
  await getDb().books.put(book);
  expect(await hasBookContent(libraryItemId)).toBe(false);
  expect(await loadReaderPayloadFromCache(libraryItemId)).toBeNull();
});

it("preserves an existing accepted book when a response supplies a different final content identity", async () => {
  const initial = canonicalFixture();
  const libraryItemId = initial.book.libraryItemId;
  await saveBookOffline({
    libraryItemId,
    saveKind: "explicit",
    fetchChapter: async () => initial,
  });
  const prior = await getDb().books.get(libraryItemId);
  const changed = structuredClone(initial);
  changed.readerPackage!.final_content_id = "content-other-final";
  const result = await saveBookOffline({
    libraryItemId,
    saveKind: "explicit",
    fetchChapter: async () => changed,
  });
  expect(result.kind).toBe("failed");
  expect(await getDb().books.get(libraryItemId)).toEqual(prior);
  expect(await hasBookContent(libraryItemId)).toBe(true);
});

it("rejects an older API payload without an authoritative chapter order", async () => {
  const initial = payload();
  delete initial.chapterIds;
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async () => initial,
  });
  expect(result.kind).toBe("failed");
  expect(await hasBookContent(itemId)).toBe(false);
});

it("requires the PDF Library entry's accepted final content identity before any write", async () => {
  const initial = canonicalFixture();
  const libraryItemId = initial.book.libraryItemId;
  await seedItem(initial);
  await getDb().libraryItems.update(libraryItemId, {
    pdfImport: {
      ...pdfStatus,
      libraryItemId,
      status: "READY",
      finalContentId: "another-accepted-content",
    },
  });
  const result = await saveBookOffline({
    libraryItemId,
    saveKind: "explicit",
    fetchChapter: async () => initial,
  });
  expect(result.kind).toBe("failed");
  expect(await getDb().bookChapters.count()).toBe(0);
  expect(await getDb().libraryItems.get(libraryItemId)).toMatchObject({
    savedOffline: false,
    offlineRequested: true,
  });
});

it("a superseded late READY response cannot overwrite the completed successor", async () => {
  let release!: (value: ReaderStatusPayload) => void;
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<ReaderStatusPayload>((resolve) => {
    release = resolve;
  });
  const first = saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      if (!id) return payload();
      started();
      return pending;
    },
  });
  await requested;
  const winner = payload(["one", "two", "three"]);
  winner.chapters[1].blocks = [
    { id: "winner", kind: "paragraph", text: "Winner", inlines: [] },
  ];
  expect(
    await saveBookOffline({
      libraryItemId: itemId,
      saveKind: "explicit",
      fetchChapter: async () => winner,
    }),
  ).toEqual({ kind: "saved" });
  const before = await getDb().bookChapters.toArray();
  release(payload(["two", "three"]));
  expect(await first).toEqual({ kind: "cancelled" });
  expect(await getDb().bookChapters.toArray()).toEqual(before);
  expect(getBookSaveSnapshot(itemId).status).toBe("saved");
});

it("checks persisted coverage again before completion when a previously written chapter disappeared", async () => {
  await seedItem(payload());
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      if (id) await getDb().bookChapters.delete([itemId, "one"]);
      return payload(id ? [id] : ["one"]);
    },
  });
  expect(result.kind).toBe("failed");
  expect(await getDb().books.get(itemId)).toBeUndefined();
  expect(await getDb().libraryItems.get(itemId)).toMatchObject({
    savedOffline: false,
  });
});

it("does not expose cached content that differs from the Library entry's accepted final content", async () => {
  const initial = canonicalFixture();
  const libraryItemId = initial.book.libraryItemId;
  await seedItem(initial);
  await saveBookOffline({
    libraryItemId,
    saveKind: "explicit",
    fetchChapter: async () => initial,
  });
  await getDb().libraryItems.update(libraryItemId, {
    pdfImport: {
      ...pdfStatus,
      libraryItemId,
      status: "READY",
      finalContentId: "another-accepted-content",
    },
  });
  expect(await hasBookContent(libraryItemId)).toBe(false);
  expect(await loadReaderPayloadFromCache(libraryItemId)).toBeNull();
});

it("downloads the authoritative EPUB spine even when its authored TOC lists only the first chapter", async () => {
  const ids = ["one", "two", "three", "four"];
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      const next = payload(id ? [id] : ["one"]);
      next.chapterIds = ids;
      next.toc = [next.toc[0]];
      return next;
    },
  });
  expect(result).toEqual({ kind: "saved" });
  expect((await getDb().books.get(itemId))?.chapterIds).toEqual(ids);
  expect(await hasBookContent(itemId)).toBe(true);
  expect((await loadReaderPayloadFromCache(itemId, "four"))?.status).toBe(
    "READY",
  );
});

it("rejects a changed legacy revision without replacing the committed book, chapters or journal", async () => {
  await seedItem(payload());
  const original = payload(["one", "two", "three"]);
  await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async () => original,
  });
  const before = {
    book: await getDb().books.get(itemId),
    chapters: await getDb().bookChapters.toArray(),
    meta: await getDb().meta.toArray(),
  };
  const changed = structuredClone(original);
  changed.contentRevision = "2".repeat(64);
  changed.chapters[0].blocks = [
    { kind: "paragraph", id: "changed", text: "Replacement", inlines: [] },
  ];
  expect(
    (
      await saveBookOffline({
        libraryItemId: itemId,
        saveKind: "explicit",
        fetchChapter: async () => changed,
      })
    ).kind,
  ).toBe("failed");
  expect({
    book: await getDb().books.get(itemId),
    chapters: await getDb().bookChapters.toArray(),
    meta: await getDb().meta.toArray(),
  }).toEqual(before);
  expect(await hasBookContent(itemId)).toBe(true);
  expect((await getDb().libraryItems.get(itemId))?.savedOffline).toBe(true);
});

it("retains unverified old cached passages when the older API cannot provide a complete offline manifest", async () => {
  const old = payload();
  await applyBookContent({
    libraryItemId: itemId,
    metadata: old.book,
    toc: old.toc,
    chapterIds: ["one", "two", "three"],
  });
  await applyChapter({
    libraryItemId: itemId,
    chapterId: "one",
    index: 0,
    blocks: old.chapters[0].blocks,
  });
  const before = await getDb().books.get(itemId);
  delete old.chapterIds;
  delete old.contentRevision;
  expect(
    (
      await saveBookOffline({
        libraryItemId: itemId,
        saveKind: "explicit",
        fetchChapter: async () => old,
      })
    ).kind,
  ).toBe("failed");
  expect(await getDb().books.get(itemId)).toEqual(before);
  expect(await hasBookContent(itemId)).toBe(false);
  expect((await loadReaderPayloadFromCache(itemId, "one"))?.status).toBe(
    "READY",
  );
  expect(await loadReaderPayloadFromCache(itemId, "three")).toBeNull();
});

it("does not silently replace an unverified old cached passage during online qualification", async () => {
  const old = payload();
  const blocks = [
    {
      kind: "paragraph" as const,
      id: "old",
      text: "Retained original",
      inlines: [],
    },
  ];
  await applyBookContent({
    libraryItemId: itemId,
    metadata: old.book,
    toc: old.toc,
    chapterIds: ["one", "two", "three"],
  });
  await applyChapter({
    libraryItemId: itemId,
    chapterId: "one",
    index: 0,
    blocks,
  });
  expect(
    (
      await saveBookOffline({
        libraryItemId: itemId,
        saveKind: "explicit",
        fetchChapter: async () => old,
      })
    ).kind,
  ).toBe("failed");
  expect((await getDb().bookChapters.get([itemId, "one"]))?.blocks).toEqual(
    blocks,
  );
  expect((await loadReaderPayloadFromCache(itemId, "one"))?.status).toBe(
    "READY",
  );
});

it("does not discard an old cached chapter from the committed order when online qualification uses different IDs", async () => {
  const old = payload();
  await applyBookContent({
    libraryItemId: itemId,
    metadata: old.book,
    toc: old.toc,
    chapterIds: ["old-chapter"],
  });
  await applyChapter({
    libraryItemId: itemId,
    chapterId: "old-chapter",
    index: 0,
    blocks: [],
  });
  expect(
    (
      await saveBookOffline({
        libraryItemId: itemId,
        saveKind: "explicit",
        fetchChapter: async () => payload(),
      })
    ).kind,
  ).toBe("failed");
  expect((await getDb().books.get(itemId))?.chapterIds).toEqual([
    "old-chapter",
  ]);
  expect(
    (await loadReaderPayloadFromCache(itemId, "old-chapter"))?.status,
  ).toBe("READY");
});

it("does not reuse old-revision partial rows when resuming a new uncommitted download", async () => {
  await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      if (id) throw new Error("Interrupted");
      return payload();
    },
  });
  const calls: Array<string | undefined> = [];
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      calls.push(id);
      const next = payload(id ? [id] : ["two"]);
      next.contentRevision = "2".repeat(64);
      next.chapters.forEach((chapter) => {
        chapter.blocks = [
          {
            id: `new-${chapter.chapterId}`,
            kind: "paragraph",
            text: "New attempt bytes",
            inlines: [],
          },
        ];
      });
      return next;
    },
  });
  expect(result).toEqual({ kind: "saved" });
  expect(calls).toContain("one");
  expect((await getDb().bookChapters.get([itemId, "one"]))?.blocks[0].id).toBe(
    "new-one",
  );
  expect(await hasBookContent(itemId)).toBe(true);
});

it.each([
  { ids: ["one", "one"] },
  { ids: Array.from({ length: 10_001 }, (_, index) => `chapter-${index}`) },
])("rejects an invalid or over-bound offline chapter order", async (ids) => {
  const initial = payload();
  initial.chapterIds = ids.ids;
  expect(
    (
      await saveBookOffline({
        libraryItemId: itemId,
        saveKind: "explicit",
        fetchChapter: async () => initial,
      })
    ).kind,
  ).toBe("failed");
  expect(await getDb().bookChapters.count()).toBe(0);
});

it("retains old readable passages when a book switch interrupts online qualification", async () => {
  const initial = payload();
  await applyBookContent({
    libraryItemId: itemId,
    metadata: initial.book,
    toc: initial.toc,
    chapterIds: ["one", "two", "three"],
  });
  await applyChapter({
    libraryItemId: itemId,
    chapterId: "one",
    index: 0,
    blocks: [],
  });
  let release!: (value: ReaderStatusPayload) => void;
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<ReaderStatusPayload>((resolve) => {
    release = resolve;
  });
  const running = saveBookOffline({
    libraryItemId: itemId,
    saveKind: "auto",
    fetchChapter: async (_, id) => {
      if (!id) return initial;
      started();
      return pending;
    },
  });
  await requested;
  abortInFlightExcept("new-reading-book");
  release(payload(["two", "three"]));
  expect(await running).toEqual({ kind: "cancelled" });
  expect((await loadReaderPayloadFromCache(itemId, "one"))?.status).toBe(
    "READY",
  );
  expect(await hasBookContent(itemId)).toBe(false);
});

it("does not recreate coverage after another tab deletes the item while a fetch is pending", async () => {
  let release!: (value: ReaderStatusPayload) => void;
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<ReaderStatusPayload>((resolve) => {
    release = resolve;
  });
  const running = saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async (_, id) => {
      if (!id) return payload();
      started();
      return pending;
    },
  });
  await requested;
  const db = getDb();
  await db.transaction("rw", [db.books, db.bookChapters, db.meta], async () => {
    await db.meta.put({
      key: `${DELETED_ITEM_PREFIX}${itemId}`,
      value: true,
      updatedAt: "now",
    });
    await db.books.delete(itemId);
    await db.bookChapters.where("libraryItemId").equals(itemId).delete();
    await clearDownloadCoverage(db, itemId);
  });
  release(payload(["two", "three"]));
  expect(await running).toEqual({ kind: "cancelled" });
  expect(await db.bookChapters.count()).toBe(0);
  expect(await db.books.get(itemId)).toBeUndefined();
  expect(await readDownloadCoverage(db, itemId)).toBeNull();
  expect((await db.meta.get(`${DELETED_ITEM_PREFIX}${itemId}`))?.value).toBe(
    true,
  );
});

it("fences the preserved-passage lookup before a subsequent helper can write into another account", async () => {
  const initial = payload();
  await applyBookContent({
    libraryItemId: itemId,
    metadata: initial.book,
    toc: initial.toc,
    chapterIds: ["one", "two", "three"],
  });
  await applyChapter({
    libraryItemId: itemId,
    chapterId: "one",
    index: 0,
    blocks: [],
  });
  const originalDb = getDb();
  const realGet = originalDb.bookChapters.get.bind(originalDb.bookChapters);
  const lookup = vi
    .spyOn(originalDb.bookChapters, "get")
    .mockImplementationOnce((key, thenShortcut) =>
      realGet(key, thenShortcut).then((prior) => {
        setActiveUser("offline-completeness-owner");
        return prior;
      }),
    );
  const result = await saveBookOffline({
    libraryItemId: itemId,
    saveKind: "explicit",
    fetchChapter: async () => initial,
  });
  lookup.mockRestore();
  expect(result).toEqual({ kind: "cancelled" });
  expect(await getDb().bookChapters.count()).toBe(0);
  expect(await readDownloadCoverage(getDb(), itemId)).toBeNull();
});

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";

import { applyBookContent } from "@/features/offline/buckets/book";
import { __resetDbForTests, getDb } from "@/features/offline/db";

import { resolveCachedLibraryItemId } from "./resolve-cached-library-item-id";

beforeEach(() => {
  __resetDbForTests();
});

async function seedCachedBook(libraryItemId: string, slug: string) {
  await applyBookContent({
    libraryItemId,
    toc: [],
    chapterIds: ["ch-1"],
    metadata: {
      libraryItemId,
      slug,
      title: "Title",
      authors: [],
      primaryFormat: "EPUB",
    },
  });
}

describe("resolveCachedLibraryItemId", () => {
  it("resolves from the library preview when the slug is listed there", async () => {
    const db = getDb();
    await db.libraryItems.put({
      libraryItemId: "lib-1",
      slug: "in-preview",
      title: "Title",
      authors: [],
      coverImageUrl: null,
      completionPercent: 0,
      primaryFormat: "EPUB",
      lastReadAt: null,
      coverBlob: null,
      savedOffline: true,
      savedAutomatically: false,
      savedAt: null,
      offlineRequested: false,
      serverUpdatedAt: null,
    });

    expect(await resolveCachedLibraryItemId("in-preview")).toBe("lib-1");
  });

  // The regression: /library carries only 4 books per collection, so a saved
  // book outside every preview has no libraryItems row and used to read as
  // "not on this device" even with its content fully cached.
  it("falls back to cached content for a slug outside every collection preview", async () => {
    await seedCachedBook("lib-2", "outside-preview");

    expect(await resolveCachedLibraryItemId("outside-preview")).toBe("lib-2");
  });

  it("returns null for a slug this device knows nothing about", async () => {
    expect(await resolveCachedLibraryItemId("unknown")).toBeNull();
  });
});

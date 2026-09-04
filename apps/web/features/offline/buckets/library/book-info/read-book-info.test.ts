import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LibraryBookInfo } from "@/lib/api-types/library";

import { DB_NAME, __resetDbForTests } from "../../../db";
import { __resetLibraryBucketForTests } from "../bucket";
import { readBookInfoBySlug } from "./read-book-info";
import { payload } from "../test-fixture";
import { applyBookInfoPayload } from "./write-book-info";
import { applyLibraryPayload } from "../collections/write-library";

beforeEach(async () => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
  await indexedDB.deleteDatabase(DB_NAME);
});

afterEach(() => {
  __resetDbForTests();
  __resetLibraryBucketForTests();
});

describe("readBookInfoBySlug", () => {
  it("caches and reads back book-info details", async () => {
    const book: LibraryBookInfo = {
      libraryItemId: "lib-9",
      slug: "war-and-peace",
      title: "War and Peace",
      authors: ["Tolstoy"],
      coverImageUrl: null,
      completionPercent: 12,
      primaryFormat: "EPUB",
      addedAt: "2026-01-01T00:00:00Z",
      approximateBodyPageCount: null,
      approximatePageCount: 1296,
      chapterLabel: "Volume One, Part One, Chapter 1",
      collections: [
        { id: "col-1", kind: "CUSTOM", name: "Favorites", smartKey: null },
      ],
      description: "Epic of Russian society during the Napoleonic era.",
      genres: ["Fiction", "Classic"],
      language: "ru",
      lastReadAt: "2026-02-01T00:00:00Z",
      minutesRead: 240,
      publishedYear: 1869,
      source: "CATALOG",
    };
    await applyBookInfoPayload(book);
    const round = await readBookInfoBySlug("war-and-peace");
    expect(round).toEqual(book);
  });

  it("readBookInfoBySlug returns null when details have never been fetched", async () => {
    // Listing alone (no book-info visit) doesn't populate details.
    await applyLibraryPayload(payload());
    const round = await readBookInfoBySlug("book-a");
    expect(round).toBeNull();
  });
});

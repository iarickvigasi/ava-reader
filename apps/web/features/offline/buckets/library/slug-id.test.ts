import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LibraryPayload } from "@/lib/api-types/library";

import { __resetDbForTests } from "../../db";
import { __resetLibraryBucketForTests } from "./bucket";
import { applyLibraryPayload, readLibraryItemIdBySlug } from "./storage";

const PAYLOAD: LibraryPayload = {
  summary: { booksCount: 1, collectionsCount: 1 },
  collections: [
    {
      id: "col-1",
      slug: "imported",
      kind: "SMART",
      name: "Imported",
      description: null,
      smartKey: "imported",
      itemCount: 1,
      unreadCount: 0,
      books: [
        {
          libraryItemId: "li-dune",
          slug: "dune-by-frank-herbert",
          title: "Dune",
          authors: ["Frank Herbert"],
          coverImageUrl: null,
          completionPercent: 0,
          primaryFormat: "EPUB",
          lastReadAt: "2026-06-01T00:00:00.000Z",
        },
      ],
    },
  ],
};

beforeEach(async () => {
  await __resetDbForTests();
  __resetLibraryBucketForTests();
});

afterEach(async () => {
  await __resetDbForTests();
});

describe("readLibraryItemIdBySlug", () => {
  it("resolves a slug to its libraryItemId", async () => {
    await applyLibraryPayload(PAYLOAD);
    expect(await readLibraryItemIdBySlug("dune-by-frank-herbert")).toBe(
      "li-dune",
    );
  });

  it("returns null for an unknown slug", async () => {
    await applyLibraryPayload(PAYLOAD);
    expect(await readLibraryItemIdBySlug("nope")).toBeNull();
  });
});

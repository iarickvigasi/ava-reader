import { describe, expect, it, vi } from "vitest";

import type { LibraryBookView, LibraryView } from "../buckets/library/types";

import {
  META_KEY_COMPLETED,
  META_KEY_CONTENT_DONE,
  META_KEY_METADATA_DONE,
} from "./meta";
import {
  collectSmartBooks,
  primeAllCaches,
  type PrimeInternals,
  type PrimeRuntime,
} from "./prime-all";

function book(id: string, slug = id): LibraryBookView {
  return {
    libraryItemId: id,
    slug,
    title: id,
    authors: [],
    coverImageUrl: null,
    completionPercent: 0,
    primaryFormat: "EPUB",
    lastReadAt: null,
    savedOffline: false,
  };
}

function view(
  smartBooks: LibraryBookView[],
  customBooks: LibraryBookView[] = [],
): LibraryView {
  return {
    collections: [
      {
        id: "c-smart",
        slug: "imported",
        name: "Imported Books",
        description: null,
        kind: "SMART",
        smartKey: "imported-library",
        itemCount: smartBooks.length,
        unreadCount: 0,
        books: smartBooks,
      },
      {
        id: "c-custom",
        slug: "faves",
        name: "Favourites",
        description: null,
        kind: "CUSTOM",
        smartKey: null,
        itemCount: customBooks.length,
        unreadCount: 0,
        books: customBooks,
      },
    ],
    summary: { booksCount: smartBooks.length, collectionsCount: 2 },
  };
}

type Harness = {
  internals: PrimeInternals;
  runtime: PrimeRuntime;
  flags: Map<string, string>;
  saveBook: ReturnType<typeof vi.fn>;
  revalidateBookInfo: ReturnType<typeof vi.fn>;
  revalidateLibrary: ReturnType<typeof vi.fn>;
};

function setup(overrides: Partial<PrimeInternals> = {}): Harness {
  const flags = new Map<string, string>();
  const saveBook = vi.fn(async () => ({ kind: "saved" }) as const);
  const revalidateBookInfo = vi.fn(async () => {});
  const revalidateLibrary = vi.fn(async () => {});

  const internals: PrimeInternals = {
    shouldPrime: () => true,
    isOnline: () => true,
    hasInFlightSaves: () => false,
    readLibraryView: async () => view([book("a"), book("b")]),
    readHome: async () => ({}),
    readBookInfo: async () => ({}),
    revalidateHome: async () => {},
    revalidateLibrary,
    revalidateBookInfo,
    hasBookContent: async () => false,
    checkStorageQuota: async () => ({ ok: true }),
    hasMetaFlag: async (key) => flags.has(key),
    setMetaFlag: async (key, value) => {
      flags.set(key, value);
    },
    now: () => "T",
    ...overrides,
  };

  return {
    internals,
    runtime: { getToken: async () => "token", saveBook },
    flags,
    saveBook,
    revalidateBookInfo,
    revalidateLibrary,
  };
}

describe("collectSmartBooks", () => {
  it("returns only books from SMART collections, deduped, in order", () => {
    const shared = book("a");
    const v = view([shared, book("b")], [shared, book("c")]);
    expect(collectSmartBooks(v).map((b) => b.libraryItemId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("primeAllCaches", () => {
  it("does nothing when shouldPrime is false", async () => {
    const h = setup({ shouldPrime: () => false });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.revalidateLibrary).not.toHaveBeenCalled();
    expect(h.saveBook).not.toHaveBeenCalled();
    expect(h.flags.size).toBe(0);
  });

  it("does nothing when already completed", async () => {
    const h = setup();
    h.flags.set(META_KEY_COMPLETED, "T");
    await primeAllCaches(h.runtime, h.internals);
    expect(h.revalidateLibrary).not.toHaveBeenCalled();
    expect(h.saveBook).not.toHaveBeenCalled();
  });

  it("happy path: primes metadata + content and sets all flags", async () => {
    const h = setup();
    await primeAllCaches(h.runtime, h.internals);

    expect(h.revalidateLibrary).toHaveBeenCalledTimes(1);
    expect(h.revalidateBookInfo).toHaveBeenCalledTimes(2);
    expect(h.saveBook).toHaveBeenCalledTimes(2);
    expect(h.saveBook).toHaveBeenCalledWith("a");
    expect(h.saveBook).toHaveBeenCalledWith("b");
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);
  });

  it("only enumerates books from smart collections", async () => {
    const h = setup({
      readLibraryView: async () => view([book("a")], [book("custom")]),
    });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.revalidateBookInfo).toHaveBeenCalledTimes(1);
    expect(h.saveBook).toHaveBeenCalledTimes(1);
    expect(h.saveBook).toHaveBeenCalledWith("a");
  });

  it("does not mark metadata done when a book-info is missing from cache", async () => {
    const h = setup({
      readBookInfo: async (slug: string) => (slug === "b" ? null : {}),
    });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(false);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(false);
  });

  it("yields book content when the user has a save in flight", async () => {
    const h = setup({ hasInFlightSaves: () => true });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).not.toHaveBeenCalled();
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(false);
    // Metadata tier still completes independently.
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(false);
  });

  it("yields book content when a save is cancelled (user took over)", async () => {
    const saveBook = vi.fn(async () => ({ kind: "cancelled" }) as const);
    const h = setup();
    h.runtime.saveBook = saveBook;
    await primeAllCaches(h.runtime, h.internals);
    expect(saveBook).toHaveBeenCalledTimes(1); // stopped after the first
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(false);
  });

  it("treats the storage floor as a terminal state for content", async () => {
    const h = setup({ checkStorageQuota: async () => ({ ok: false }) });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).not.toHaveBeenCalled();
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);
  });

  it("skips books whose content is already cached", async () => {
    const h = setup({
      hasBookContent: async (id: string) => id === "a",
    });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).toHaveBeenCalledTimes(1);
    expect(h.saveBook).toHaveBeenCalledWith("b");
  });

  it("does not re-run the metadata tier when already done", async () => {
    const h = setup();
    h.flags.set(META_KEY_METADATA_DONE, "T");
    await primeAllCaches(h.runtime, h.internals);
    expect(h.revalidateLibrary).not.toHaveBeenCalled();
    // ...but content still runs.
    expect(h.saveBook).toHaveBeenCalledTimes(2);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);
  });

  it("does not mark metadata done when the library view is unavailable", async () => {
    const h = setup({ readLibraryView: async () => null });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(false);
    expect(h.saveBook).not.toHaveBeenCalled();
  });
});

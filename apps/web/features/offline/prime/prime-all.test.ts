import { describe, expect, it, vi } from "vitest";

import type { LibraryBookView, LibraryView } from "../buckets/library/types";

import {
  CONTENT_CONSENT_GRANTED,
  META_KEY_COMPLETED,
  META_KEY_CONTENT_CONSENT,
  META_KEY_CONTENT_DONE,
  META_KEY_METADATA_DONE,
} from "./meta";
import {
  collectSmartBooks,
  primeAllCaches,
  type PrimeInternals,
  type PrimeRuntime,
} from "./prime-all";

function book(
  id: string,
  opts: { slug?: string; offlineRequested?: boolean } = {},
): LibraryBookView {
  return {
    libraryItemId: id,
    slug: opts.slug ?? id,
    title: id,
    authors: [],
    coverImageUrl: null,
    completionPercent: 0,
    primaryFormat: "EPUB",
    lastReadAt: null,
    savedOffline: false,
    offlineRequested: opts.offlineRequested ?? false,
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
  revalidateCollection: ReturnType<typeof vi.fn>;
  revalidatePreferences: ReturnType<typeof vi.fn>;
  revalidateHighlights: ReturnType<typeof vi.fn>;
  revalidateAiComments: ReturnType<typeof vi.fn>;
};

function setup(overrides: Partial<PrimeInternals> = {}): Harness {
  const flags = new Map<string, string>();
  const saveBook = vi.fn(async () => ({ kind: "saved" }) as const);
  const revalidateBookInfo = vi.fn(async () => {});
  const revalidateLibrary = vi.fn(async () => {});
  const revalidateCollection = vi.fn(async () => {});
  const revalidatePreferences = vi.fn(async () => {});
  const revalidateHighlights = vi.fn(async () => {});
  const revalidateAiComments = vi.fn(async () => {});

  const internals: PrimeInternals = {
    canPrimeMetadata: () => true,
    isSaveDataOn: () => false,
    isOnline: () => true,
    hasInFlightSaves: () => false,
    readLibraryView: async () =>
      view([
        book("a", { offlineRequested: true }),
        book("b", { offlineRequested: true }),
      ]),
    readHome: async () => ({}),
    readBookInfo: async () => ({}),
    revalidateHome: async () => {},
    revalidateLibrary,
    revalidateCollection,
    revalidateBookInfo,
    revalidatePreferences,
    revalidateHighlights,
    revalidateAiComments,
    hasBookContent: async () => false,
    checkStorageQuota: async () => ({ ok: true }),
    getMetaFlag: async (key) => flags.get(key) ?? null,
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
    revalidateCollection,
    revalidatePreferences,
    revalidateHighlights,
    revalidateAiComments,
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
  it("does nothing when the connection can't prime metadata", async () => {
    const h = setup({ canPrimeMetadata: () => false });
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

  it("happy path: primes metadata, preferences, content + annotations", async () => {
    const h = setup();
    const result = await primeAllCaches(h.runtime, h.internals);

    expect(h.revalidatePreferences).toHaveBeenCalledTimes(1);
    expect(h.revalidateLibrary).toHaveBeenCalledTimes(1);
    // Each smart collection is hydrated in full before enumerating books.
    expect(h.revalidateCollection).toHaveBeenCalledWith("imported", expect.any(Function));
    expect(h.revalidateBookInfo).toHaveBeenCalledTimes(2);
    expect(h.saveBook).toHaveBeenCalledWith("a");
    expect(h.saveBook).toHaveBeenCalledWith("b");
    expect(h.revalidateHighlights).toHaveBeenCalledTimes(2);
    expect(h.revalidateAiComments).toHaveBeenCalledTimes(2);
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);
    expect(result.contentConsentNeeded).toBe(false);
  });

  it("content tier targets only offline-marked books (metadata covers all)", async () => {
    const h = setup({
      readLibraryView: async () =>
        view([
          book("a", { offlineRequested: true }),
          book("b", { offlineRequested: false }),
        ]),
    });
    await primeAllCaches(h.runtime, h.internals);
    // book-info primed for both smart books...
    expect(h.revalidateBookInfo).toHaveBeenCalledTimes(2);
    // ...but content + annotations only for the offline-marked one.
    expect(h.saveBook).toHaveBeenCalledTimes(1);
    expect(h.saveBook).toHaveBeenCalledWith("a");
    expect(h.revalidateHighlights).toHaveBeenCalledTimes(1);
  });

  it("only enumerates books from smart collections", async () => {
    const h = setup({
      readLibraryView: async () =>
        view([book("a", { offlineRequested: true })], [book("custom")]),
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
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(false);
  });

  it("yields book content when a save is cancelled (user took over)", async () => {
    const saveBook = vi.fn(async () => ({ kind: "cancelled" }) as const);
    const h = setup();
    h.runtime.saveBook = saveBook;
    await primeAllCaches(h.runtime, h.internals);
    expect(saveBook).toHaveBeenCalledTimes(1);
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(false);
  });

  it("treats the storage floor as a terminal state for content", async () => {
    const h = setup({ checkStorageQuota: async () => ({ ok: false }) });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).not.toHaveBeenCalled();
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);
  });

  it("skips books whose content is already cached but still backfills annotations", async () => {
    const h = setup({
      hasBookContent: async (id: string) => id === "a",
    });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).toHaveBeenCalledTimes(1);
    expect(h.saveBook).toHaveBeenCalledWith("b");
    expect(h.revalidateHighlights).toHaveBeenCalledTimes(2);
  });

  it("does not re-run the metadata tier when already done", async () => {
    const h = setup();
    h.flags.set(META_KEY_METADATA_DONE, "T");
    await primeAllCaches(h.runtime, h.internals);
    expect(h.revalidateLibrary).not.toHaveBeenCalled();
    expect(h.saveBook).toHaveBeenCalledTimes(2);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);
  });

  it("does not mark metadata done when the library view is unavailable", async () => {
    const h = setup({ readLibraryView: async () => null });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(false);
    expect(h.saveBook).not.toHaveBeenCalled();
  });

  describe("Save-Data consent gating (content tier)", () => {
    it("flags consent needed and skips content when Save-Data is on and unanswered", async () => {
      const h = setup({ isSaveDataOn: () => true });
      const result = await primeAllCaches(h.runtime, h.internals);
      expect(result.contentConsentNeeded).toBe(true);
      expect(h.saveBook).not.toHaveBeenCalled();
      expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(false);
      // Metadata still primes on Save-Data.
      expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(true);
    });

    it("runs content when Save-Data is on but consent was granted", async () => {
      const h = setup({ isSaveDataOn: () => true });
      h.flags.set(META_KEY_CONTENT_CONSENT, CONTENT_CONSENT_GRANTED);
      const result = await primeAllCaches(h.runtime, h.internals);
      expect(result.contentConsentNeeded).toBe(false);
      expect(h.saveBook).toHaveBeenCalledTimes(2);
      expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(true);
    });

    it("re-offers (does not remember a decline) — asks again while unanswered", async () => {
      // A decline isn't persisted, so a later run under Save-Data still asks.
      const h = setup({ isSaveDataOn: () => true });
      const first = await primeAllCaches(h.runtime, h.internals);
      const second = await primeAllCaches(h.runtime, h.internals);
      expect(first.contentConsentNeeded).toBe(true);
      expect(second.contentConsentNeeded).toBe(true);
      expect(h.saveBook).not.toHaveBeenCalled();
    });

    it("adds a storage-full callback path (terminal) without throwing", async () => {
      const onStorageFull = vi.fn();
      const h = setup({ checkStorageQuota: async () => ({ ok: false }) });
      h.runtime.onStorageFull = onStorageFull;
      await primeAllCaches(h.runtime, h.internals);
      expect(onStorageFull).toHaveBeenCalledTimes(1);
    });
  });
});

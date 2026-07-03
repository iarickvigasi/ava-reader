import { describe, expect, it, vi } from "vitest";

import type { LibraryBookView, LibraryView } from "../buckets/library/types";
import type { PrimeProgress } from "../status/prime-progress";

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
  revalidateProgress: ReturnType<typeof vi.fn>;
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
  const revalidateProgress = vi.fn(async () => {});

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
    readCurrentBookId: async () => null,
    readHome: async () => ({}),
    readBookInfo: async () => ({}),
    revalidateHome: async () => {},
    revalidateLibrary,
    revalidateCollection,
    revalidateBookInfo,
    revalidatePreferences,
    revalidateHighlights,
    revalidateAiComments,
    revalidateProgress,
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
    revalidateProgress,
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

  it("does nothing when completed and every offline book is already cached", async () => {
    const h = setup({ hasBookContent: async () => true });
    h.flags.set(META_KEY_COMPLETED, "T");
    await primeAllCaches(h.runtime, h.internals);
    expect(h.revalidateLibrary).not.toHaveBeenCalled();
    expect(h.saveBook).not.toHaveBeenCalled();
  });

  it("reconciles outstanding offline content when completed, without re-running metadata", async () => {
    // Warm device (already primed), but the user marked two books offline
    // afterwards (e.g. tapped Save while disconnected): their content is
    // missing, so a reconnect pass must download it.
    const h = setup(); // a, b offlineRequested; hasBookContent=false → outstanding
    h.flags.set(META_KEY_COMPLETED, "T");
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).toHaveBeenCalledWith("a");
    expect(h.saveBook).toHaveBeenCalledWith("b");
    // The bulk metadata tier does NOT re-run on a warm device.
    expect(h.revalidateLibrary).not.toHaveBeenCalled();
    expect(h.revalidateBookInfo).not.toHaveBeenCalled();
  });

  it("reconcile is consent-exempt: downloads requested books under Save-Data with no prompt", async () => {
    const h = setup({ isSaveDataOn: () => true });
    h.flags.set(META_KEY_COMPLETED, "T");
    const result = await primeAllCaches(h.runtime, h.internals);
    expect(result.contentConsentNeeded).toBe(false);
    expect(h.saveBook).toHaveBeenCalledTimes(2);
  });

  it("reconcile also caches the current book when Save-Data allows (warm device)", async () => {
    // A book started reading after the device finished priming (its content was
    // never downloaded, and it isn't offline-marked) must still reconcile so
    // "continue reading" reads offline. Save-Data off → allowed.
    const h = setup({
      readLibraryView: async () => view([book("a", { offlineRequested: false })]),
      readCurrentBookId: async () => "a",
      hasBookContent: async () => false,
    });
    h.flags.set(META_KEY_COMPLETED, "T");
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).toHaveBeenCalledWith("a", "auto");
  });

  it("reconcile withholds the current book under Save-Data decline, but still reconciles offline-marked books", async () => {
    const h = setup({
      isSaveDataOn: () => true,
      readLibraryView: async () =>
        view([
          book("a", { offlineRequested: true }), // consent-exempt
          book("b", { offlineRequested: false }), // current, needs consent
        ]),
      readCurrentBookId: async () => "b",
      hasBookContent: async () => false,
    });
    h.flags.set(META_KEY_COMPLETED, "T");
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).toHaveBeenCalledWith("a"); // reconciled (consent-exempt)
    expect(h.saveBook).not.toHaveBeenCalledWith("b", "auto"); // withheld
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
    // Progress is revalidated per offline book too, so a fresh device resumes
    // on the right page (not chapter 1) once the "Ready offline" cue shows.
    expect(h.revalidateProgress).toHaveBeenCalledTimes(2);
    expect(h.revalidateProgress).toHaveBeenCalledWith("a", expect.any(Function));
    expect(h.flags.has(META_KEY_METADATA_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_CONTENT_DONE)).toBe(true);
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);
    expect(result.contentConsentNeeded).toBe(false);
  });

  it("reports content progress only, ending with ready (metadata not surfaced)", async () => {
    const h = setup(); // two smart books, both offline-marked: a, b
    const ticks: PrimeProgress[] = [];
    const onProgress = (p: PrimeProgress) => ticks.push(p);
    await primeAllCaches({ ...h.runtime, onProgress }, h.internals);
    expect(ticks).toEqual([
      { phase: "content", done: 0, total: 2 },
      { phase: "content", done: 1, total: 2 },
      { phase: "content", done: 2, total: 2 },
      { phase: "ready" },
    ]);
  });

  it("emits ready only on the first completion, not on a warm re-run", async () => {
    const h = setup();
    const first: PrimeProgress[] = [];
    await primeAllCaches(
      { ...h.runtime, onProgress: (p) => first.push(p) },
      h.internals,
    );
    expect(first.at(-1)).toEqual({ phase: "ready" });
    expect(h.flags.has(META_KEY_COMPLETED)).toBe(true);

    // Warm device (completed + everything cached): early-returns, no ready.
    const warm = setup({ hasBookContent: async () => true });
    warm.flags.set(META_KEY_COMPLETED, "T");
    const second: PrimeProgress[] = [];
    await primeAllCaches(
      { ...warm.runtime, onProgress: (p) => second.push(p) },
      warm.internals,
    );
    expect(second).toEqual([]);
  });

  it("still signals ready when no book is marked offline", async () => {
    const h = setup({
      readLibraryView: async () =>
        view([
          book("a", { offlineRequested: false }),
          book("b", { offlineRequested: false }),
        ]),
    });
    const ticks: PrimeProgress[] = [];
    await primeAllCaches(
      { ...h.runtime, onProgress: (p) => ticks.push(p) },
      h.internals,
    );
    // Metadata isn't surfaced; the content tier has nothing to do (total 0),
    // then the run signals ready — the user's "safe to browse offline" cue.
    expect(ticks).toEqual([{ phase: "content", done: 0, total: 0 }, { phase: "ready" }]);
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

  it("also caches the current continue-reading book, evictably (auto), even when unmarked", async () => {
    // The reported bug: the header says "Ready for offline work" but the book
    // the user is actually reading isn't offline-marked, so tapping "continue
    // reading" offline hit the missing-book modal. The primer must cache it.
    const h = setup({
      readLibraryView: async () =>
        view([
          book("a", { offlineRequested: true }),
          book("b", { offlineRequested: false }), // current book, not marked
        ]),
      readCurrentBookId: async () => "b",
    });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).toHaveBeenCalledWith("a"); // offline-marked → explicit
    expect(h.saveBook).toHaveBeenCalledWith("b", "auto"); // current → evictable
    expect(h.saveBook).toHaveBeenCalledTimes(2);
  });

  it("withholds the ready cue when the current book's content isn't actually cached", async () => {
    // Regression: the header showed "Ready for offline work" while the current
    // book's background auto-save had failed, so going offline and tapping
    // continue-reading hit the missing-book modal. The cue must wait for the
    // current book's content to be present (see [[11-cache-priming]]).
    const saveBook = vi.fn(async (_id: string, kind?: string) =>
      kind === "auto"
        ? ({ kind: "failed", reason: "network" } as const)
        : ({ kind: "saved" } as const),
    );
    const h = setup({
      readLibraryView: async () =>
        view([book("b", { offlineRequested: false })]),
      readCurrentBookId: async () => "b",
      hasBookContent: async () => false, // b's save failed → never cached
    });
    h.runtime.saveBook = saveBook;
    const ticks: PrimeProgress[] = [];
    await primeAllCaches(
      { ...h.runtime, onProgress: (p) => ticks.push(p) },
      h.internals,
    );
    expect(saveBook).toHaveBeenCalledWith("b", "auto");
    expect(ticks.some((t) => t.phase === "ready")).toBe(false);
  });

  it("signals ready once the current book's content is present", async () => {
    const h = setup({
      readLibraryView: async () =>
        view([book("b", { offlineRequested: false })]),
      readCurrentBookId: async () => "b",
      hasBookContent: async () => true, // already cached
    });
    const ticks: PrimeProgress[] = [];
    await primeAllCaches(
      { ...h.runtime, onProgress: (p) => ticks.push(p) },
      h.internals,
    );
    expect(ticks.at(-1)).toEqual({ phase: "ready" });
  });

  it("reconcile withholds ready when the current book still fails to cache", async () => {
    // Warm device: the current book is outstanding but its auto-save keeps
    // failing. The reconcile pass runs, but "Ready" must not fire until the
    // content is genuinely present.
    const saveBook = vi.fn(async () => ({ kind: "failed", reason: "x" }) as const);
    const h = setup({
      readLibraryView: async () =>
        view([book("b", { offlineRequested: false })]),
      readCurrentBookId: async () => "b",
      hasBookContent: async () => false,
    });
    h.runtime.saveBook = saveBook;
    h.flags.set(META_KEY_COMPLETED, "T");
    const ticks: PrimeProgress[] = [];
    await primeAllCaches(
      { ...h.runtime, onProgress: (p) => ticks.push(p) },
      h.internals,
    );
    expect(saveBook).toHaveBeenCalledWith("b", "auto");
    expect(ticks.some((t) => t.phase === "ready")).toBe(false);
  });

  it("does not double-save when the current book is also offline-marked (explicit wins)", async () => {
    const h = setup({
      readLibraryView: async () =>
        view([book("a", { offlineRequested: true })]),
      readCurrentBookId: async () => "a",
    });
    await primeAllCaches(h.runtime, h.internals);
    expect(h.saveBook).toHaveBeenCalledTimes(1);
    expect(h.saveBook).toHaveBeenCalledWith("a"); // explicit, not "auto"
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

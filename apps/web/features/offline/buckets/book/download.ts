// Save-a-book-offline orchestrator. Walks the book's TOC and fetches every
// chapter the reader exposes, writing each into Dexie as it lands. Designed
// to be:
//   - cancellable (a per-libraryItemId AbortController; cancelling cleans
//     up the partial rows it wrote so the DB never holds half a book)
//   - idempotent (resuming after a network blip skips chapters already on
//     disk; safe to call multiple times)
//   - dependency-light (the chapter fetcher is injected so this module can
//     be unit-tested without Clerk or the reader-client)

import type { ReaderStatusPayload } from "@/lib/api-types/reader";

import { getDb } from "../../db";
import { pickStrideTargets } from "./download-chapter-plan";
import { readCoveredChapterIds, validChapterOrder } from "./download-coverage";
import {
  persistChaptersFromPayload,
  withConcurrency,
} from "./download-windows";
export { pickStrideTargets } from "./download-chapter-plan";
import {
  downloadContentIdentity,
  requireDownloadPayload,
} from "./download-payload";

import { setStatus } from "./bucket";
import { createDownloadScope, type SaveOutcome } from "./download-scope";
export type { SaveOutcome } from "./download-scope";
import {
  applyBookContent,
  attachCoverBlob,
  hasBookContent,
  markBookSaved,
  readBookContent,
  readCachedChapterIds,
  type SaveKind,
} from "./storage";

export type ChapterFetcher = (
  libraryItemId: string,
  chapterId: string | undefined,
  signal: AbortSignal,
) => Promise<ReaderStatusPayload>;

export type CoverFetcher = (
  url: string,
  signal: AbortSignal,
) => Promise<Blob | null>;

type SaveBookOptions = {
  libraryItemId: string;
  saveKind: SaveKind;
  fetchChapter: ChapterFetcher;
  // Optional — when omitted we still record the book content but don't try
  // to cache the cover. Tests skip it; the real reader passes a real fetcher.
  fetchCover?: CoverFetcher;
  // Optional cover URL override; usually the library bucket already has it
  // on the LibraryItemRow, so we read it from there if not supplied.
  coverImageUrl?: string | null;
  // Concurrency limit for chapter fetches. Default 3 — enough to overlap
  // network round-trips without overwhelming the API.
  concurrency?: number;
  signal?: AbortSignal;
};

const DEFAULT_CONCURRENCY = 3;

// Internal cover URL resolver — reads off the library row if the caller
// didn't pass one. Returns null when there's nothing to fetch.
async function resolveCoverUrl(
  libraryItemId: string,
  override: string | null | undefined,
): Promise<string | null> {
  if (override !== undefined) {
    return override;
  }
  const db = getDb();
  const row = await db.libraryItems.get(libraryItemId);
  return row?.coverImageUrl ?? null;
}

export async function saveBookOffline(
  options: SaveBookOptions,
): Promise<SaveOutcome> {
  const {
    libraryItemId,
    saveKind,
    fetchChapter,
    fetchCover,
    coverImageUrl,
    concurrency = DEFAULT_CONCURRENCY,
  } = options;
  if (options.signal?.aborted) return { kind: "cancelled" };
  const scope = createDownloadScope(libraryItemId, options.signal);
  const ownerDb = scope.db;
  const assertOwned = scope.assertOwned;
  let preserveExistingBook = false;

  try {
    const prior = await readBookContent(libraryItemId);
    assertOwned();
    preserveExistingBook = Boolean(prior);
    const preserveExistingPassages = Boolean(
      prior && !prior.canonical?.readerPackage && !prior.contentRevision,
    );
    const item = await ownerDb.libraryItems.get(libraryItemId);
    assertOwned();
    // Step 1 — discovery. The initial reader fetch (no chapter param)
    // returns the active chapter, its window, and the full TOC.
    const initial = await fetchChapter(libraryItemId, undefined, scope.signal);
    assertOwned();
    requireDownloadPayload(
      initial,
      libraryItemId,
      prior
        ? downloadContentIdentity({
            ...prior.canonical,
            contentRevision: prior.contentRevision,
          })
        : undefined,
    );
    if (
      item?.pdfImport?.finalContentId &&
      initial.readerPackage?.final_content_id !== item.pdfImport.finalContentId
    )
      throw new Error(
        "Reader response does not match the accepted book content",
      );
    const identity = downloadContentIdentity(initial);
    if (!identity) throw new Error("Missing reader content identity");

    const chapterIds = initial.readerPackage?.book.spine ?? initial.chapterIds!;
    // A window is not proof of a whole book. Malformed discovery must fail
    // rather than mark only the initial visible chapters as downloaded.
    const ordered = chapterIds;
    if (!validChapterOrder(ordered))
      throw new Error("Reader did not provide a complete chapter order");
    if (preserveExistingPassages) {
      const cached = await readCachedChapterIds(libraryItemId);
      assertOwned();
      if (
        prior!.chapterIds.some((id) => cached.has(id) && !ordered.includes(id))
      )
        throw new Error(
          "Reader response would remove an existing offline passage",
        );
    }

    setStatus(libraryItemId, { totalChapters: ordered.length });

    const covered = await readCoveredChapterIds(
      ownerDb,
      libraryItemId,
      identity,
    );
    assertOwned();
    for (const id of covered) if (!ordered.includes(id)) covered.delete(id);
    const writtenFromInitial = await persistChaptersFromPayload(
      libraryItemId,
      initial,
      ordered,
      assertOwned,
      ownerDb,
      identity,
      preserveExistingPassages,
    );
    for (const id of writtenFromInitial) {
      covered.add(id);
    }
    assertOwned();
    setStatus(libraryItemId, { currentChapters: covered.size });

    // Step 2 — fetch the rest. The reader API returns a 3-chapter window
    // (the requested chapter ±1), so we don't need to ask for every id:
    // hitting every third index — 1, 4, 7, … — covers the whole spine.
    // We additionally pick a starting offset that skips chapters the initial
    // payload + resume already gave us, then run a "fill gaps" pass against
    // anything still missing afterwards (asymmetric backend windows,
    // boundary cases). Net effect: ~ceil(N/3) fetches instead of N, and
    // zero overlap between concurrent workers.
    const strideTargets = pickStrideTargets(ordered, covered);

    await withConcurrency(strideTargets, concurrency, async (chapterId) => {
      if (scope.signal.aborted) {
        return;
      }
      // Even with stride scheduling, a previous worker's window might have
      // already covered this id (e.g. when resume left a partial chunk on
      // disk). Re-check before paying for the fetch.
      if (covered.has(chapterId)) {
        return;
      }
      const payload = await fetchChapter(
        libraryItemId,
        chapterId,
        scope.signal,
      );
      assertOwned();
      requireDownloadPayload(payload, libraryItemId, identity);
      if (
        !payload.readerPackage &&
        (payload.chapterIds!.length !== ordered.length ||
          payload.chapterIds!.some((id, index) => id !== ordered[index]))
      )
        throw new Error("Reader chapter order changed during offline download");
      const written = await persistChaptersFromPayload(
        libraryItemId,
        payload,
        ordered,
        assertOwned,
        ownerDb,
        identity,
        preserveExistingPassages,
        chapterId,
      );
      for (const id of written) {
        covered.add(id);
      }
      assertOwned();
      setStatus(libraryItemId, { currentChapters: covered.size });
    });

    // Step 2.5 — fill gaps. If the backend's window shape differs from
    // ±1 (e.g. forward-only), the stride pass may have left holes. Fetch
    // each remaining chapter individually, sequentially, until all covered.
    const stillMissing = ordered.filter((id) => !covered.has(id));
    for (const chapterId of stillMissing) {
      if (scope.signal.aborted) {
        // Route through the shared cleanup so partial rows are cleaned up
        // and status is reset to idle — same as every other cancellation path.
        return await scope.fail(
          new DOMException("Aborted", "AbortError"),
          preserveExistingBook,
        );
      }
      if (covered.has(chapterId)) {
        continue;
      }
      const payload = await fetchChapter(
        libraryItemId,
        chapterId,
        scope.signal,
      );
      assertOwned();
      requireDownloadPayload(payload, libraryItemId, identity);
      if (
        !payload.readerPackage &&
        (payload.chapterIds!.length !== ordered.length ||
          payload.chapterIds!.some((id, index) => id !== ordered[index]))
      )
        throw new Error("Reader chapter order changed during offline download");
      const written = await persistChaptersFromPayload(
        libraryItemId,
        payload,
        ordered,
        assertOwned,
        ownerDb,
        identity,
        preserveExistingPassages,
        chapterId,
      );
      for (const id of written) {
        covered.add(id);
      }
      assertOwned();
      setStatus(libraryItemId, { currentChapters: covered.size });
    }

    assertOwned();
    const stored = await readCoveredChapterIds(
      ownerDb,
      libraryItemId,
      identity,
    );
    assertOwned();
    if (ordered.some((id) => !stored.has(id)))
      throw new Error("Offline download is missing required chapters");

    // Step 3 — cache the cover blob. Best-effort; a missing cover doesn't
    // invalidate the save.
    if (fetchCover) {
      const url = await resolveCoverUrl(libraryItemId, coverImageUrl);
      if (url) {
        try {
          const blob = await fetchCover(url, scope.signal);
          assertOwned();
          if (blob) {
            await ownerDb.transaction(
              "rw",
              [ownerDb.libraryItems, ownerDb.meta],
              async () => {
                assertOwned();
                await attachCoverBlob(libraryItemId, blob);
                assertOwned();
              },
            );
          }
        } catch {
          // Cover failures don't fail the save.
        }
      }
    }

    // Step 4 — publish completion and flags together, with the complete
    // stored chapter set checked inside the same owned transaction.
    assertOwned();
    await ownerDb.transaction(
      "rw",
      [ownerDb.books, ownerDb.bookChapters, ownerDb.libraryItems, ownerDb.meta],
      async () => {
        assertOwned();
        await applyBookContent({
          libraryItemId,
          toc: initial.toc,
          chapterIds: ordered,
          contentRevision: initial.contentRevision,
          metadata: initial.book,
          canonical: initial.readerPackage
            ? {
                readerPackage: initial.readerPackage,
                resourceUrls: initial.resourceUrls,
              }
            : undefined,
        });
        assertOwned();
        if (!(await hasBookContent(libraryItemId)))
          throw new Error("Offline download is incomplete");
        assertOwned();
        await markBookSaved(libraryItemId, saveKind);
        assertOwned();
      },
    );
    assertOwned();

    setStatus(libraryItemId, {
      status: "saved",
      error: null,
    });
    return { kind: "saved" };
  } catch (error) {
    // Genuine error bubbling out of a fetch/write (network, malformed
    // payload, an abort surfaced by a called function, …) — same cleanup as
    // the inline conditions above.
    return await scope.fail(error, preserveExistingBook);
  } finally {
    scope.release();
  }
}

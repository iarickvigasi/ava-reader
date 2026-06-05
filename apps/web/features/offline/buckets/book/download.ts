// Save-a-book-offline orchestrator. Walks the book's TOC and fetches every
// chapter the reader exposes, writing each into Dexie as it lands. Designed
// to be:
//   - cancellable (a per-libraryItemId AbortController; cancelling cleans
//     up the partial rows it wrote so the DB never holds half a book)
//   - idempotent (resuming after a network blip skips chapters already on
//     disk; safe to call multiple times)
//   - dependency-light (the chapter fetcher is injected so this module can
//     be unit-tested without Clerk or the reader-client)
//
// Eviction policy lives here too: a successful auto-save drops the previous
// auto-saved book (max one auto-save at a time). Explicit saves are sticky.

import type { ReaderStatusPayload } from "@/lib/api-types/reader";

import { getDb } from "../../db";

import {
  abortInFlightExcept,
  clearInFlight,
  registerInFlight,
  setStatus,
} from "./bucket";
import {
  applyBookContent,
  applyChapter,
  attachCoverBlob,
  deleteBookContent,
  findPreviousAutoSavedId,
  markBookSaved,
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

export type SaveOutcome =
  | { kind: "saved" }
  | { kind: "cancelled" }
  | { kind: "failed"; reason: string };

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

// Concurrency-bounded map over an array of items. No external dep; ~10 LOC.
async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function step() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) {
        return;
      }
      out[i] = await worker(items[i]!, i);
    }
  }
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    () => step(),
  );
  await Promise.all(runners);
  return out;
}

// Stride-3 scheduling: given an ordered chapter list and the set of ids we
// already have on disk, returns the minimal set of "fetch anchors" that
// will cover everything that isn't covered yet, assuming the API returns a
// 3-chapter window (±1) per call.
//
// Strategy: pick indices i = 1, 4, 7, …, but
//   - skip any anchor whose chapter id (and ±1 neighbours) are already on
//     disk — no point fetching to cover what we already have,
//   - if the very first chapter isn't covered, use index 1 (or 0 for a
//     single-chapter book) to anchor it.
//
// The result feeds into a concurrent worker pool with zero overlap because
// each anchor's window covers a disjoint 3-chapter slice.
export function pickStrideTargets(
  ordered: string[],
  covered: Set<string>,
): string[] {
  if (ordered.length === 0) {
    return [];
  }
  // Simulate the coverage each anchor will gain so we don't add a final
  // anchor for a chapter that a stride window will already cover.
  const willCover = new Set(covered);
  const out: string[] = [];
  // Walk anchors at stride 3 starting from index 1 (so window i-1, i, i+1
  // catches the first chapter). Single-chapter book uses index 0.
  let i = ordered.length === 1 ? 0 : 1;
  for (; i < ordered.length; i += 3) {
    const slice = [
      ordered[i - 1],
      ordered[i],
      ordered[i + 1],
    ].filter((id): id is string => !!id);
    if (slice.every((id) => willCover.has(id))) {
      continue;
    }
    out.push(ordered[i]!);
    for (const id of slice) {
      willCover.add(id);
    }
  }
  // Last-chapter guard. After simulating every stride anchor, if the spine
  // length doesn't line up the last id may still be uncovered.
  const last = ordered[ordered.length - 1]!;
  if (!willCover.has(last) && !out.includes(last)) {
    out.push(last);
  }
  return out;
}

// Flattens a possibly-nested ReaderTocNode tree into the ordered list of
// chapter ids that actually map to content. Skips nodes with no chapterId
// (pure section headings, etc.) and dedupes — some books reference the same
// chapter from multiple TOC entries.
function flattenTocChapterIds(
  toc: { chapterId: string | null; children: unknown[] }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  function walk(nodes: typeof toc) {
    for (const node of nodes) {
      if (node.chapterId && !seen.has(node.chapterId)) {
        seen.add(node.chapterId);
        out.push(node.chapterId);
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children as typeof toc);
      }
    }
  }
  walk(toc);
  return out;
}

// Persists every chapter in a windowed payload (the reader API returns the
// requested chapter plus up to ±1 neighbours) into Dexie. Returns the chapter
// ids we wrote so the caller can mark them covered and skip later fetches.
async function persistChaptersFromPayload(
  libraryItemId: string,
  payload: ReaderStatusPayload,
  chapterOrder: string[],
): Promise<string[]> {
  if (payload.status !== "READY") {
    return [];
  }
  const orderById = new Map(
    chapterOrder.map((id, index) => [id, index] as const),
  );
  const written: string[] = [];
  for (const chapter of payload.chapters) {
    const index = orderById.get(chapter.chapterId);
    if (index === undefined) {
      // Chapter the reader knows about but the TOC doesn't list. Save it
      // anyway with a synthetic index past the end so it's still readable
      // offline; the reader walks via nextChapterId, not the TOC index.
      await applyChapter({
        libraryItemId,
        chapterId: chapter.chapterId,
        index: chapterOrder.length,
        blocks: chapter.blocks,
      });
      written.push(chapter.chapterId);
      continue;
    }
    await applyChapter({
      libraryItemId,
      chapterId: chapter.chapterId,
      index,
      blocks: chapter.blocks,
    });
    written.push(chapter.chapterId);
  }
  return written;
}

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

  // Compose with the caller's signal so external aborts also fire ours.
  // Internally we also abort any other in-flight save for a different book
  // (the user opened a new one) — but the bucket layer handles that via
  // abortInFlightExcept.
  const controller = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) {
      return { kind: "cancelled" };
    }
    options.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }
  registerInFlight(libraryItemId, controller);
  // Per spec: starting a new save aborts any in-flight save for a different
  // book. Doing it here (before any IO) keeps the cleanup ordering simple.
  abortInFlightExcept(libraryItemId);

  setStatus(libraryItemId, {
    status: "saving",
    currentChapters: 0,
    totalChapters: 0,
    error: null,
  });

  try {
    // Step 1 — discovery. The initial reader fetch (no chapter param)
    // returns the active chapter, its window, and the full TOC.
    const initial = await fetchChapter(
      libraryItemId,
      undefined,
      controller.signal,
    );
    if (initial.status !== "READY") {
      throw new Error(`Book is not READY (status: ${initial.status})`);
    }

    const chapterIds = flattenTocChapterIds(initial.toc);
    // Fall back to whatever the initial window contained if the TOC has no
    // chapter ids (some malformed feeds): saving just those is better than
    // saving nothing.
    const ordered = chapterIds.length
      ? chapterIds
      : initial.chapters.map((chapter) => chapter.chapterId);

    setStatus(libraryItemId, { totalChapters: ordered.length });

    const covered = await readCachedChapterIds(libraryItemId);
    const writtenFromInitial = await persistChaptersFromPayload(
      libraryItemId,
      initial,
      ordered,
    );
    for (const id of writtenFromInitial) {
      covered.add(id);
    }
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
      if (controller.signal.aborted) {
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
        controller.signal,
      );
      const written = await persistChaptersFromPayload(
        libraryItemId,
        payload,
        ordered,
      );
      for (const id of written) {
        covered.add(id);
      }
      setStatus(libraryItemId, { currentChapters: covered.size });
    });

    // Step 2.5 — fill gaps. If the backend's window shape differs from
    // ±1 (e.g. forward-only), the stride pass may have left holes. Fetch
    // each remaining chapter individually, sequentially, until all covered.
    const stillMissing = ordered.filter((id) => !covered.has(id));
    for (const chapterId of stillMissing) {
      if (controller.signal.aborted) {
        return { kind: "cancelled" };
      }
      if (covered.has(chapterId)) {
        continue;
      }
      const payload = await fetchChapter(
        libraryItemId,
        chapterId,
        controller.signal,
      );
      const written = await persistChaptersFromPayload(
        libraryItemId,
        payload,
        ordered,
      );
      for (const id of written) {
        covered.add(id);
      }
      setStatus(libraryItemId, { currentChapters: covered.size });
    }

    if (controller.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    // Step 3 — write the BookRow last. hasBookContent uses this row as the
    // "all done" sentinel; if the orchestrator dies before this point we
    // have orphaned chapter rows but no book row, and the reader treats the
    // book as "not saved" — correct.
    await applyBookContent({
      libraryItemId,
      toc: initial.toc,
      chapterIds: ordered,
      metadata: initial.book,
    });

    // Step 4 — cache the cover blob. Best-effort; a missing cover doesn't
    // invalidate the save.
    if (fetchCover) {
      const url = await resolveCoverUrl(libraryItemId, coverImageUrl);
      if (url) {
        try {
          const blob = await fetchCover(url, controller.signal);
          if (blob) {
            await attachCoverBlob(libraryItemId, blob);
          }
        } catch {
          // Cover failures don't fail the save.
        }
      }
    }

    // Step 5 — flip the LibraryItem flags.
    await markBookSaved(libraryItemId, saveKind);

    // Step 6 — evict the previous auto-saved book (if any and we're auto).
    // Explicit saves never trigger eviction; explicit-saved books are never
    // candidates for eviction either (findPreviousAutoSavedId filters them
    // out via the `savedAutomatically && !savedOffline` predicate).
    if (saveKind === "auto") {
      const prior = await findPreviousAutoSavedId(libraryItemId);
      if (prior) {
        await deleteBookContent(prior);
      }
    }

    setStatus(libraryItemId, {
      status: "saved",
      error: null,
    });
    return { kind: "saved" };
  } catch (error) {
    // Cancelled — clean up partial rows so the user doesn't end up with a
    // ghost half-saved book in their cache. Status returns to idle.
    if (
      controller.signal.aborted ||
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      await deleteBookContent(libraryItemId).catch(() => {
        // Cleanup is best-effort.
      });
      setStatus(libraryItemId, {
        status: "idle",
        currentChapters: 0,
        totalChapters: 0,
        error: null,
      });
      return { kind: "cancelled" };
    }

    // Real failure (network, malformed payload, …). Also clean up so a
    // retry starts from a clean slate.
    await deleteBookContent(libraryItemId).catch(() => {});
    const reason =
      error instanceof Error ? error.message : "Unknown save error";
    setStatus(libraryItemId, { status: "failed", error: reason });
    return { kind: "failed", reason };
  } finally {
    clearInFlight(libraryItemId);
  }
}

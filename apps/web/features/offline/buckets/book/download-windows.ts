import { canonicalChapters } from "@/features/reader/canonical/chapters";
import { requireCompleteCanonicalResources } from "@/features/reader/canonical/resource-completeness";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import type { AvaReaderDB } from "../../db";
import { applyChapter } from "./storage";
import { recordDownloadCoverage } from "./download-coverage";
import { isLibraryItemDeleted } from "../library/deleted-items";

// Bound concurrent windows; stop scheduling after failure and settle started
// workers before the operation's cleanup can finish.
export async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  let failed = false;
  async function step() {
    while (!failed) {
      const i = cursor++;
      if (i >= items.length) {
        return;
      }
      try {
        out[i] = await worker(items[i]!, i);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    step(),
  );
  // Drain already-started writes before failure cleanup. An early Promise.all
  // rejection used to allow a sibling worker to refill a cancelled book.
  const results = await Promise.allSettled(runners);
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected?.status === "rejected") throw rejected.reason;
  return out;
}

// Persists every chapter in a windowed payload (the reader API returns the
// requested chapter plus up to ±1 neighbours) into Dexie. Returns the chapter
// ids we wrote so the caller can mark them covered and skip later fetches.
export async function persistChaptersFromPayload(
  libraryItemId: string,
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
  chapterOrder: string[],
  assertOwned: () => void,
  ownerDb: AvaReaderDB,
  contentIdentity: string,
  preserveExistingPassages: boolean,
  requestedChapterId?: string,
): Promise<string[]> {
  assertOwned();
  requireCompleteCanonicalResources(payload);
  const orderById = new Map(
    chapterOrder.map((id, index) => [id, index] as const),
  );
  const written: string[] = [];
  const chapters = payload.readerPackage
    ? canonicalChapters(payload.readerPackage.book, payload.resourceUrls ?? {})
    : payload.chapters;
  if (
    requestedChapterId &&
    !chapters.some((chapter) => chapter.chapterId === requestedChapterId)
  )
    throw new Error(
      `Reader response omitted requested chapter: ${requestedChapterId}`,
    );
  await ownerDb.transaction(
    "rw",
    [ownerDb.bookChapters, ownerDb.meta],
    async () => {
      assertOwned();
      if (await isLibraryItemDeleted(ownerDb, libraryItemId))
        throw new DOMException("Library item was deleted", "AbortError");
      for (const chapter of chapters) {
        assertOwned();
        const index = orderById.get(chapter.chapterId);
        if (index === undefined) continue;
        if (preserveExistingPassages) {
          const prior = await ownerDb.bookChapters.get([
            libraryItemId,
            chapter.chapterId,
          ]);
          if (
            prior &&
            JSON.stringify(prior.blocks) !== JSON.stringify(chapter.blocks)
          )
            throw new Error(
              "Reader response would replace an existing offline passage",
            );
        }
        assertOwned();
        await applyChapter({
          libraryItemId,
          chapterId: chapter.chapterId,
          index,
          blocks: chapter.blocks,
        });
        written.push(chapter.chapterId);
      }
      await recordDownloadCoverage(
        ownerDb,
        libraryItemId,
        contentIdentity,
        written,
      );
      assertOwned();
    },
  );
  return written;
}

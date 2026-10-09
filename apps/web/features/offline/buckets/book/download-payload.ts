import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import type { CanonicalCache } from "./canonical-cache";
import { validChapterOrder } from "./download-coverage";

export function downloadContentIdentity(
  cache: CanonicalCache & { contentRevision?: string },
): string | undefined {
  const pkg = cache.readerPackage;
  return pkg
    ? `canonical:${pkg.final_content_id}:${pkg.canonical_sha256}`
    : cache.contentRevision
      ? `epub:${cache.contentRevision}`
      : undefined;
}

export function requireDownloadPayload(
  payload: ReaderStatusPayload,
  libraryItemId: string,
  contentIdentity?: string,
): asserts payload is Extract<ReaderStatusPayload, { status: "READY" }> {
  if (payload.status !== "READY")
    throw new Error(`Book is not READY (status: ${payload.status})`);
  if (payload.book.libraryItemId !== libraryItemId)
    throw new Error("Reader response belongs to another library item");
  if (
    !payload.readerPackage &&
    (!validChapterOrder(payload.chapterIds) ||
      !payload.contentRevision ||
      !/^[a-f0-9]{64}$/.test(payload.contentRevision))
  )
    throw new Error("The complete offline reader manifest is unavailable");
  if (
    contentIdentity !== undefined &&
    downloadContentIdentity(payload) !== contentIdentity
  )
    throw new Error("Reader content changed during offline download");
}

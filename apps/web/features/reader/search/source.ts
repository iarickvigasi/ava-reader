import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import { downloadContentIdentity } from "@/features/offline/buckets/book/download-payload";

type Ready = Extract<ReaderStatusPayload, { status: "READY" }>;
export function searchSourceIdentity(source: Ready) {
  return JSON.stringify([
    source.book.libraryItemId,
    downloadContentIdentity(source),
    source.chapterIds ?? null,
  ]);
}

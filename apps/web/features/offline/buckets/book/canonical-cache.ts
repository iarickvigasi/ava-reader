import type { ReaderStatusPayload } from "@/lib/api-types/reader";
import type { BookRow } from "../../db";
import { canonicalPayload } from "@/features/reader/canonical/payload";

export type CanonicalCache = Pick<
  Extract<ReaderStatusPayload, { status: "READY" }>,
  "readerPackage" | "resourceUrls"
>;

export function readCanonicalCache(
  book: BookRow,
  payload: Extract<ReaderStatusPayload, { status: "READY" }>,
): ReaderStatusPayload {
  return canonicalPayload({ ...payload, ...book.canonical });
}

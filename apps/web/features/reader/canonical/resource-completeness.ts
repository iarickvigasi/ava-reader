import type { ReaderStatusPayload } from "@/lib/api-types/reader";

export function requireCompleteCanonicalResources(
  payload: ReaderStatusPayload,
) {
  if (payload.status !== "READY" || !payload.readerPackage) return;
  if (
    payload.resourceFailures?.length ||
    payload.readerPackage.book.resources.some(
      (resource) =>
        !payload.resourceUrls?.[resource.id]?.startsWith(
          `data:${resource.media_type};base64,`,
        ),
    )
  )
    throw new Error("Reader resources are incomplete");
}

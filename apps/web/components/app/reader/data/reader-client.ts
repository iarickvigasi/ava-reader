import { loadReaderPayloadFromCache } from "@/features/offline/buckets/book";
import { type ReaderAuthInput, resolveReaderAuthToken } from "./reader-auth";
import { fetchReaderPayloadFromNetwork } from "./reader-payload-network";
import {
  HTTP_METHOD_POST,
  buildReaderUrl,
  withAuthHeader,
} from "./reader-request";

// Public re-exports — keeps `../data/reader-client` as the single import
// surface for the reader controller hooks.
export type { ReaderAuthInput } from "./reader-auth";

// Cache-first chapter loading, online or offline. Parsed content is immutable;
// the book bucket fills missing metadata separately for older downloads.
export async function fetchReaderPayload(
  input: ReaderAuthInput & {
    chapterId?: string;
    libraryItemId: string;
    signal?: AbortSignal;
  },
) {
  const cached = await loadReaderPayloadFromCache(
    input.libraryItemId,
    input.chapterId,
  ).catch(() => null);
  if (cached) {
    return cached;
  }

  return fetchReaderPayloadFromNetwork(input);
}

// Records that the user opened the book — drives "last opened" timestamps
// and analytics. `keepalive` lets it complete during page unload.
export async function markReaderOpened(
  input: ReaderAuthInput & {
    libraryItemId: string;
  },
) {
  const token = await resolveReaderAuthToken(input);

  const response = await fetch(
    buildReaderUrl(input.libraryItemId, "open").toString(),
    {
      method: HTTP_METHOD_POST,
      keepalive: true,
      headers: withAuthHeader(token),
    },
  );

  if (!response.ok) {
    throw new Error("The reader open event could not be persisted.");
  }
}

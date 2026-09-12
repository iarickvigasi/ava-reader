import type { ReaderStatusPayload } from "@/lib/api-types/reader";

import { type ReaderAuthInput, resolveReaderAuthToken } from "./reader-auth";
import { buildReaderUrl, withAuthHeader } from "./reader-request";

// The book bucket also uses this network-only path to fill missing metadata
// in legacy downloads. Normal chapter reads stay cache-first in reader-client.
export async function fetchReaderPayloadFromNetwork(
  input: ReaderAuthInput & {
    chapterId?: string;
    libraryItemId: string;
    signal?: AbortSignal;
  },
): Promise<ReaderStatusPayload> {
  const token = await resolveReaderAuthToken(input);
  const url = buildReaderUrl(input.libraryItemId);
  if (input.chapterId) {
    url.searchParams.set("chapter", input.chapterId);
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: withAuthHeader(token),
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error("The reader payload could not be loaded.");
  }
  return (await response.json()) as ReaderStatusPayload;
}

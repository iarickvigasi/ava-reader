import { loadCanonicalResources } from "@/features/reader/canonical/resources";
import {
  READER_SCHEMA,
  READER_BUILD_FINGERPRINT,
} from "@/features/reader/canonical/build";
import type { ReaderStatusPayload } from "@/lib/api-types/reader";

import { type ReaderAuthInput, resolveReaderAuthToken } from "./reader-auth";
import { ReaderPayloadError } from "./reader-payload-error";
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
    headers: withAuthHeader(token, {
      "X-AVA-Reader-Schema": READER_SCHEMA,
      "X-AVA-Reader-Build": READER_BUILD_FINGERPRINT,
    }),
    signal: input.signal,
  });
  if (!response.ok) {
    // Only the known compatibility response is actionable in the reader UI.
    // Malformed bodies and other HTTP errors remain generic; raw server text
    // must never become reader-facing copy.
    const body: unknown = await response.json().catch(() => null);
    const code =
      response.status === 409 &&
      body !== null &&
      typeof body === "object" &&
      "code" in body &&
      body.code === "PDF_READER_UPGRADE_REQUIRED"
        ? body.code
        : undefined;
    throw new ReaderPayloadError(response.status, code);
  }
  return loadCanonicalResources(
    (await response.json()) as ReaderStatusPayload,
    { token, apiBase: url.origin, signal: input.signal },
  );
}

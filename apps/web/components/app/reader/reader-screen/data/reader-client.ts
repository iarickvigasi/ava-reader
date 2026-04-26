import type {
  ReaderLocator,
  ReaderProgressPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";
import { type ReaderAuthInput, resolveReaderAuthToken } from "./reader-auth";
import {
  HTTP_METHOD_PATCH,
  HTTP_METHOD_POST,
  buildReaderUrl,
  jsonContentTypeHeader,
  withAuthHeader,
} from "./reader-request";

// Public re-exports — keeps `../data/reader-client` as the single import
// surface for the reader controller hooks.
export {
  heartbeatReaderSession,
  startReaderSession,
  stopReaderSession,
} from "./reader-session-client";
export { getOrCreateReaderClientInstanceId } from "./reader-client-instance-id";
export type { ReaderAuthInput } from "./reader-auth";

// Loads the reader payload (text + status) for a library item, optionally
// scoped to a specific chapter. Supports cancellation via AbortSignal.
export async function fetchReaderPayload(
  input: ReaderAuthInput & {
    chapterId?: string;
    libraryItemId: string;
    signal?: AbortSignal;
  },
) {
  const token = await resolveReaderAuthToken(input);

  const url = buildReaderUrl(input.libraryItemId);
  if (input.chapterId) {
    url.searchParams.set("chapter", input.chapterId);
  }

  const response = await fetch(url.toString(), {
    headers: withAuthHeader(token),
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error("The reader payload could not be loaded.");
  }

  return (await response.json()) as ReaderStatusPayload;
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

// Persists the reader's current locator (page / CFI) so progress survives
// reloads. Debounced by the caller; `keepalive` flushes on tab close.
export async function persistReaderProgress(
  input: ReaderAuthInput & {
    keepalive?: boolean;
    libraryItemId: string;
    locator: ReaderLocator;
  },
) {
  const token = await resolveReaderAuthToken(input);

  const response = await fetch(
    buildReaderUrl(input.libraryItemId, "progress").toString(),
    {
      method: HTTP_METHOD_PATCH,
      headers: withAuthHeader(token, jsonContentTypeHeader()),
      keepalive: input.keepalive,
      body: JSON.stringify({
        locator: input.locator,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Reader progress could not be saved.");
  }

  return (await response.json()) as ReaderProgressPayload;
}

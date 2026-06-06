import type { ReaderSessionPayload } from "@/lib/api-types";
import { type ReaderAuthInput, resolveReaderAuthToken } from "./reader-auth";
import {
  HTTP_METHOD_PATCH,
  HTTP_METHOD_POST,
  buildReaderUrl,
  jsonContentTypeHeader,
  withAuthHeader,
} from "./reader-request";

// Reader-session subroutes. POST /session opens, PATCH /session heartbeats,
// POST /session/stop closes.
const READER_SESSION_PATH_SESSION = "session";
const READER_SESSION_PATH_SESSION_STOP = "session/stop";

// Opens a fresh reader session for this client instance and returns the
// server-assigned session id used by subsequent heartbeats / stop calls.
//
// Phase 4: callers may pass an idempotency triplet
// (clientSessionId/startedAt/endedAt) so the same session id is recognised
// across retries — and an offline-completed session can be replayed in a
// single call after reconnect, preserving its original timestamps.
export async function startReaderSession(
  input: ReaderAuthInput & {
    clientInstanceId: string;
    libraryItemId: string;
    signal?: AbortSignal;
    clientSessionId?: string;
    startedAt?: string;
    endedAt?: string | null;
  },
) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
      ...(input.clientSessionId
        ? { clientSessionId: input.clientSessionId }
        : {}),
      ...(input.startedAt ? { startedAt: input.startedAt } : {}),
      ...(input.endedAt ? { endedAt: input.endedAt } : {}),
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    libraryItemId: input.libraryItemId,
    method: HTTP_METHOD_POST,
    path: READER_SESSION_PATH_SESSION,
    signal: input.signal,
  });
}

// Tells the server the reader is still active so the session does not
// time out while the user keeps reading.
export async function heartbeatReaderSession(
  input: ReaderAuthInput & {
    clientInstanceId: string;
    libraryItemId: string;
    sessionId: string;
  },
) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
      sessionId: input.sessionId,
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    libraryItemId: input.libraryItemId,
    method: HTTP_METHOD_PATCH,
    path: READER_SESSION_PATH_SESSION,
  });
}

// Closes the active session. `keepalive` lets the call survive a page-unload
// so we still record session end when the user navigates away.
export async function stopReaderSession(
  input: ReaderAuthInput & {
    clientInstanceId: string;
    keepalive?: boolean;
    libraryItemId: string;
    sessionId: string;
  },
) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
      sessionId: input.sessionId,
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    keepalive: input.keepalive,
    libraryItemId: input.libraryItemId,
    method: HTTP_METHOD_POST,
    path: READER_SESSION_PATH_SESSION_STOP,
  });
}

// Shared transport for the three session endpoints — they only differ in
// HTTP method, subpath, and body.
async function performReaderSessionRequest(
  input: ReaderAuthInput & {
    body?: Record<string, unknown>;
    keepalive?: boolean;
    libraryItemId: string;
    method: typeof HTTP_METHOD_PATCH | typeof HTTP_METHOD_POST;
    path:
      | typeof READER_SESSION_PATH_SESSION
      | typeof READER_SESSION_PATH_SESSION_STOP;
    signal?: AbortSignal;
  },
) {
  const token = await resolveReaderAuthToken(input);

  const response = await fetch(
    buildReaderUrl(input.libraryItemId, input.path).toString(),
    {
      method: input.method,
      headers: withAuthHeader(token, jsonContentTypeHeader()),
      body: JSON.stringify(input.body ?? {}),
      keepalive: input.keepalive,
      signal: input.signal,
    },
  );

  if (!response.ok) {
    throw new Error("Reader session tracking could not be saved.");
  }

  return (await response.json()) as ReaderSessionPayload;
}

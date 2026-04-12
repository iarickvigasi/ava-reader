import type {
  ReaderLocator,
  ReaderProgressPayload,
  ReaderSessionPayload,
  ReaderStatusPayload,
} from "@/lib/api-types";
import { getPublicApiBaseUrl } from "@/lib/api";
import { READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY } from "./constants";

type ReaderAuthInput = {
  getToken: () => Promise<string | null>;
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
};

export async function fetchReaderPayload(input: ReaderAuthInput & {
  chapterId?: string;
  libraryItemId: string;
  signal?: AbortSignal;
}) {
  if (!input.isLoaded || !input.isSignedIn) {
    return Promise.reject(
      new Error("Reader access requires an authenticated session."),
    );
  }

  const token = await input.getToken();

  if (!token) {
    return Promise.reject(new Error("No session token was available."));
  }

  const url = new URL(
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader`,
  );

  if (input.chapterId) {
    url.searchParams.set("chapter", input.chapterId);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error("The reader payload could not be loaded.");
  }

  return (await response.json()) as ReaderStatusPayload;
}

export async function markReaderOpened(input: ReaderAuthInput & {
  libraryItemId: string;
}) {
  if (!input.isLoaded || !input.isSignedIn) {
    return Promise.reject(
      new Error("Reader access requires an authenticated session."),
    );
  }

  const token = await input.getToken();

  if (!token) {
    return Promise.reject(new Error("No session token was available."));
  }

  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader/open`,
    {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("The reader open event could not be persisted.");
  }
}

export async function persistReaderProgress(input: ReaderAuthInput & {
  keepalive?: boolean;
  libraryItemId: string;
  locator: ReaderLocator;
}) {
  if (!input.isLoaded || !input.isSignedIn) {
    return Promise.reject(
      new Error("Reader access requires an authenticated session."),
    );
  }

  const token = await input.getToken();

  if (!token) {
    return Promise.reject(new Error("No session token was available."));
  }

  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader/progress`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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

export async function startReaderSession(input: ReaderAuthInput & {
  clientInstanceId: string;
  libraryItemId: string;
  signal?: AbortSignal;
}) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    libraryItemId: input.libraryItemId,
    method: "POST",
    path: "session",
    signal: input.signal,
  });
}

export async function heartbeatReaderSession(input: ReaderAuthInput & {
  clientInstanceId: string;
  libraryItemId: string;
  sessionId: string;
}) {
  return performReaderSessionRequest({
    body: {
      clientInstanceId: input.clientInstanceId,
      sessionId: input.sessionId,
    },
    getToken: input.getToken,
    isLoaded: input.isLoaded,
    isSignedIn: input.isSignedIn,
    libraryItemId: input.libraryItemId,
    method: "PATCH",
    path: "session",
  });
}

export async function stopReaderSession(input: ReaderAuthInput & {
  clientInstanceId: string;
  keepalive?: boolean;
  libraryItemId: string;
  sessionId: string;
}) {
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
    method: "POST",
    path: "session/stop",
  });
}

async function performReaderSessionRequest(input: ReaderAuthInput & {
  body?: Record<string, unknown>;
  keepalive?: boolean;
  libraryItemId: string;
  method: "PATCH" | "POST";
  path: "session" | "session/stop";
  signal?: AbortSignal;
}) {
  if (!input.isLoaded || !input.isSignedIn) {
    return Promise.reject(
      new Error("Reader access requires an authenticated session."),
    );
  }

  const token = await input.getToken();

  if (!token) {
    return Promise.reject(new Error("No session token was available."));
  }

  const response = await fetch(
    `${getPublicApiBaseUrl()}/api/library/${input.libraryItemId}/reader/${input.path}`,
    {
      method: input.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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

export function getOrCreateReaderClientInstanceId() {
  if (typeof window === "undefined") {
    return createReaderClientInstanceId();
  }

  try {
    const existingClientInstanceId = window.sessionStorage.getItem(
      READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY,
    );

    if (existingClientInstanceId) {
      return existingClientInstanceId;
    }

    const nextClientInstanceId = createReaderClientInstanceId();
    window.sessionStorage.setItem(
      READER_SESSION_CLIENT_INSTANCE_ID_STORAGE_KEY,
      nextClientInstanceId,
    );
    return nextClientInstanceId;
  } catch {
    return createReaderClientInstanceId();
  }
}

function createReaderClientInstanceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `reader-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

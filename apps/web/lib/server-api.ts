import { auth } from "@clerk/nextjs/server";
import { getServerApiBaseUrl } from "@/lib/api";

type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  headers?: HeadersInit;
  returnBackUrl?: string;
};

export class ServerApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`API request failed with status ${status}`);
    this.name = "ServerApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function fetchServerApi<T>(
  path: string,
  options: ApiRequestOptions = {},
) {
  const authState = await auth();

  if (!authState.userId) {
    authState.redirectToSignIn({
      returnBackUrl: options.returnBackUrl ?? "/app",
    });
  }

  const token = await authState.getToken();

  if (!token) {
    throw new Error("A Clerk session token was not available.");
  }

  const response = await fetch(`${getServerApiBaseUrl()}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ServerApiError(response.status, payload);
  }

  return (await response.json()) as T;
}

// Distinguishes "couldn't reach the API at all" (offline, DNS failure, the
// NestJS backend is down) from a real HTTP error response (404, 403, 500…).
//
// RSC pages use this to decide whether to fall back to client-rendering from
// the offline cache (network error) or to let the error bubble to notFound()
// / the error boundary (genuine HTTP error). A `fetch` that never gets a
// response throws a TypeError; a `ServerApiError` always carries a real HTTP
// status, so it is never a network error by definition.
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ServerApiError) {
    return false;
  }
  // `fetch` rejects with a TypeError when the request can't be made at all
  // (no connection, refused, aborted DNS). Node/undici uses the same shape
  // and often attaches a `cause`. We match on the type rather than the
  // message so we're not locked to a single runtime's wording.
  if (error instanceof TypeError) {
    return true;
  }
  // undici wraps the underlying connection failure in `cause`; surface those
  // too (ECONNREFUSED, ENOTFOUND, fetch failed, …).
  if (
    error instanceof Error &&
    typeof (error as { cause?: unknown }).cause !== "undefined"
  ) {
    return true;
  }
  return false;
}

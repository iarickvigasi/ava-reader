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

// Null when the session can't currently be verified — signed out, or a stale
// token that couldn't refresh because Clerk is unreachable (wifi drop against
// a reachable server, Clerk outage). `getToken()` can either return null or
// *throw* when Clerk's cloud is unreachable; both mean the same thing here, so
// we swallow the throw. Tolerant callers then render their offline cache path
// instead of crashing to the error boundary.
async function resolveServerAuthToken(): Promise<string | null> {
  try {
    const authState = await auth();
    if (!authState.userId) {
      return null;
    }
    return await authState.getToken();
  } catch {
    return null;
  }
}

async function fetchWithToken<T>(
  token: string,
  path: string,
  options: ApiRequestOptions,
): Promise<T> {
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

export type ServerApiResult<T> =
  | { status: "ready"; data: T }
  | { status: "apiUnavailable" | "authUnavailable" };

// Preserve the failure reason for pages that need a specific recovery state.
// HTTP 404 and other unexpected responses still reach the route/error boundary.
export async function fetchServerApiResult<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ServerApiResult<T>> {
  const token = await resolveServerAuthToken();
  if (!token) return { status: "authUnavailable" };
  try {
    return { status: "ready", data: await fetchWithToken<T>(token, path, options) };
  } catch (error) {
    if (isNetworkError(error)) return { status: "apiUnavailable" };
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return { status: "authUnavailable" };
    }
    throw error;
  }
}

// Existing cache consumers only need a payload or a cache miss.
export async function fetchServerApiTolerant<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T | null> {
  const result = await fetchServerApiResult<T>(path, options);
  return result.status === "ready" ? result.data : null;
}

// Distinguishes "couldn't reach the API at all" (offline, DNS failure, the
// NestJS backend is down) from a real HTTP error response. A `fetch` that
// never gets a response throws a TypeError (undici attaches the connection
// failure as `cause`); a ServerApiError always carries a real HTTP status.
export function isNetworkError(error: unknown): boolean {
  if (error instanceof ServerApiError) {
    return false;
  }
  if (error instanceof TypeError) {
    return true;
  }
  return error instanceof Error &&
    typeof (error as { cause?: unknown }).cause !== "undefined";

}

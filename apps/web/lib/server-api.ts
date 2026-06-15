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

// RSC data fetch for pages with an offline cache fallback. The strict variant
// (redirect when unverified) was removed: cookie-less visitors are caught by
// the middleware (apps/web/proxy.ts), and every page that fetches here has a
// cache path, so unverified-but-offline must NOT redirect.
// path. Returns null — meaning "render the cached / fallback UI" — when:
// - the session can't be verified right now (stale token, Clerk unreachable):
//   redirecting would strand an offline user on a sign-in they can't complete;
// - the API itself is unreachable (offline, backend down);
// - the API rejected the stale token (401/403) — same offline-auth situation.
// Anything else (404, 5xx, …) is a genuine error and bubbles to notFound() /
// the error boundary as usual.
export async function fetchServerApiTolerant<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T | null> {
  const token = await resolveServerAuthToken();
  if (!token) {
    return null;
  }
  try {
    return await fetchWithToken<T>(token, path, options);
  } catch (error) {
    if (isNetworkError(error)) {
      return null;
    }
    if (
      error instanceof ServerApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      return null;
    }
    throw error;
  }
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
  if (
    error instanceof Error &&
    typeof (error as { cause?: unknown }).cause !== "undefined"
  ) {
    return true;
  }
  return false;
}

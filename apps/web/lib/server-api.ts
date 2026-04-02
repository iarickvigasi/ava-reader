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

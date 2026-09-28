import { checkNetworkReachability } from "./net-state";

// Catch only the fetch itself, never callers' parsing or persistence failures.
export async function fetchWithConnectivityCheck(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    return await fetch(input, init);
  } catch (error) {
    const signal =
      init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const aborted =
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError");
    if (!aborted && error instanceof TypeError) void checkNetworkReachability();
    throw error;
  }
}

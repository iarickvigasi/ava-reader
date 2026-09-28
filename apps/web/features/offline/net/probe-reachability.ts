import { getPublicApiBaseUrl } from "@/lib/api";

// null means an HTTP error: the server responded, but cannot confirm recovery.
export async function probeReachability(
  signal: AbortSignal,
): Promise<boolean | null> {
  const response = await fetch(`${getPublicApiBaseUrl()}/api/reachability`, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal,
  });
  if (!response.ok) return null;
  try {
    const body = await response.json();
    return !response.redirected && body?.service === "ava-reader-api";
  } catch {
    return false;
  }
}

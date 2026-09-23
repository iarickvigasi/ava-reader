import { getPublicApiBaseUrl } from "@/lib/api";

type ReplayOk = { kind: "ok" };
type ReplayRetry = { kind: "retry" };
type ReplayDrop = { kind: "drop"; reason: string };
type ReplayResult = ReplayOk | ReplayRetry | ReplayDrop;

export async function postSession(
  token: string,
  clientInstanceId: string,
  row: {
    libraryItemId: string;
    clientSessionId: string;
    startedAt: string;
    endedAt: string | null;
  },
): Promise<ReplayResult> {
  const url = `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(
    row.libraryItemId,
  )}/reader/session`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        clientInstanceId,
        clientSessionId: row.clientSessionId,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
      }),
    });
    if (response.ok) {
      return { kind: "ok" };
    }
    // Same classification as the highlights flush — transient is 401/408/
    // 425/429/5xx; permanent is 4xx (drop without erroring the user).
    if (
      response.status === 401 ||
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      (response.status >= 500 && response.status < 600)
    ) {
      return { kind: "retry" };
    }
    return { kind: "drop", reason: `HTTP ${response.status}` };
  } catch {
    return { kind: "retry" };
  }
}

import { withDeadline } from "@/features/auth/with-deadline";
import { getPublicApiBaseUrl } from "@/lib/api";
import { fetchWithConnectivityCheck } from "../../net/fetch-with-connectivity-check";
import { SESSION_REQUEST_TIMEOUT_MS } from "./constants";
import { retryableSessionStatus } from "./retryable-session-status";
import type { CheckpointAck, SessionRow } from "./types";

type Result = { kind: "ok"; ack: CheckpointAck } | { kind: "retry" | "drop" };

export async function postCheckpoint(
  token: string,
  row: SessionRow,
): Promise<Result> {
  const controller = new AbortController();
  try {
    return await withDeadline(
      sendCheckpoint(token, row, controller.signal),
      SESSION_REQUEST_TIMEOUT_MS,
    );
  } catch {
    return { kind: "retry" };
  } finally {
    controller.abort();
  }
}

async function sendCheckpoint(
  token: string,
  row: SessionRow,
  signal: AbortSignal,
): Promise<Result> {
  const response = await fetchWithConnectivityCheck(
    `${getPublicApiBaseUrl()}/api/library/${encodeURIComponent(row.libraryItemId)}/reader/session/checkpoint`,
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientSessionId: row.clientSessionId,
        startedAt: row.startedAt,
        checkpointAt: row.lastHeartbeatAt,
        endedAt: row.endedAt,
        timeZone: row.timeZone,
        revision: row.revision,
      }),
    },
  );
  return readCheckpointResponse(response, row);
}

async function readCheckpointResponse(
  response: Response,
  row: SessionRow,
): Promise<Result> {
  if (!response.ok) {
    const retryable =
      retryableSessionStatus(response.status) ||
      (response.status === 404 && row.state === "open");
    return { kind: retryable ? "retry" : "drop" };
  }
  const ack = (await response.json()) as CheckpointAck;
  if (
    !ack.sessionId ||
    !Number.isInteger(ack.revision) ||
    ack.revision < row.revision
  )
    return { kind: "retry" };
  return { kind: "ok", ack };
}

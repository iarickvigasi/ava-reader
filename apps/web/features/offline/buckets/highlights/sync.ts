// Server sync: applying a fresh GET snapshot, replaying the pending queue
// against the API, the on-the-wire shape conversion, and the retry/backoff
// policy for transient failures.
//
// The queue-drain loop, backoff, and snapshot-apply live in
// ../shared/sync-core; this module supplies the highlights-specific network
// call (`sendMutation`) and result-application (`applyTerminal`).
//
// Each in-memory state change is mirrored to Dexie immediately so a tab
// crash or reload doesn't lose the post-ack snapshot or leave a flushed
// mutation in the queue.

import { notifyDrop, trackPersist } from "../shared/bucket-core";
import { classifyFailure } from "../shared/http";
import { createSyncRuntime } from "../shared/sync-core";
import { getOrCreateBucket } from "./bucket";
import {
  removePendingMutation,
  removeSnapshotRow,
  replaceSnapshot,
  upsertSnapshotRow,
} from "./storage";
import {
  type DropEvent,
  type HighlightColor,
  type HighlightRecord,
  type PendingMutation,
  type ServerAnnotation,
  type StorageBucket,
} from "./types";

type SendResult =
  | { kind: "retry" }
  | { kind: "upserted"; row: HighlightRecord | null }
  | { kind: "deleted" }
  | { kind: "drop"; reason: string };

// Tries to drain the pending queue head-first. One in-flight at a time per
// bucket so the server sees mutations in order.
//
// Outcomes per mutation:
// - Network error / 5xx / 408 / 425 / 429 / 401 → retry. We stop the loop,
//   bump the backoff timer, and schedule another flush. `online` and
//   `visibilitychange` also retry, on top of the timer.
// - 400 / 403 / 404 (upsert) / 422 / any other 4xx → permanent drop. The
//   mutation is popped from the queue and a DropEvent fires so the hook
//   can toast a user-facing message.
// - 2xx → success. Snapshot updates, backoff resets, loop continues.
const runtime = createSyncRuntime<
  HighlightRecord,
  PendingMutation,
  SendResult,
  HighlightRecord,
  StorageBucket
>({
  getOrCreateBucket,
  send: (bucket, libraryItemId, head, token) =>
    sendMutation(bucket.apiBaseUrl, libraryItemId, head, token),
  applyTerminal,
  removePendingMutation,
  // Highlights store the server snapshot rows as-is.
  toRecords: (snapshot) => snapshot,
  replaceSnapshot,
});

export const { applyServerSnapshot, flushBucket } = runtime;

// Applies a terminal (non-retry) send result to the snapshot. We *don't* roll
// back the optimistic local change on a drop — the user already sees it and
// re-applying a delete to "undo" their action would be more surprising than
// showing the toast. They can retry by clicking again.
function applyTerminal(
  bucket: StorageBucket,
  libraryItemId: string,
  head: PendingMutation,
  result: SendResult,
): HighlightRecord[] {
  let nextSnapshot = bucket.state.snapshot;
  if (result.kind === "upserted" && result.row) {
    const filtered = nextSnapshot.filter((row) => row.id !== head.id);
    nextSnapshot = [...filtered, result.row];
    // Mirror the post-ack snapshot row to Dexie.
    trackPersist(bucket, () => upsertSnapshotRow(libraryItemId, result.row!));
  } else if (result.kind === "deleted") {
    nextSnapshot = nextSnapshot.filter((row) => row.id !== head.id);
    trackPersist(bucket, () => removeSnapshotRow(libraryItemId, head.id));
  } else if (result.kind === "drop") {
    // Permanent failure. Surface to the hook so the UI can toast why.
    const event: DropEvent = {
      mutationKind: head.kind,
      highlightId: head.id,
      reason: result.reason,
    };
    notifyDrop(bucket, event);
  }
  return nextSnapshot;
}

async function sendMutation(
  apiBaseUrl: string,
  libraryItemId: string,
  mutation: PendingMutation,
  token: string,
): Promise<SendResult> {
  const url = `${apiBaseUrl}/api/library/${encodeURIComponent(
    libraryItemId,
  )}/annotations/${encodeURIComponent(mutation.id)}`;
  try {
    if (mutation.kind === "delete") {
      const response = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      // 404 on delete means "already gone" — same end state as success.
      if (response.ok || response.status === 404) {
        return { kind: "deleted" };
      }
      return classifyFailure(response);
    }
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        excerpt: mutation.payload.excerpt,
        highlightColor: mutation.payload.highlightColor,
        // Serialize the locator since the server schema accepts a string.
        locator: mutation.payload.locator
          ? JSON.stringify(mutation.payload.locator)
          : undefined,
      }),
    });
    if (response.ok) {
      const data = (await response.json()) as { item?: ServerAnnotation };
      const row = data.item ? toHighlightRecord(data.item) : null;
      return { kind: "upserted", row };
    }
    return classifyFailure(response);
  } catch {
    // Network failure (offline, DNS, etc.). Always retryable.
    return { kind: "retry" };
  }
}

export function toHighlightRecord(
  annotation: ServerAnnotation,
): HighlightRecord {
  return {
    id: annotation.id,
    excerpt: annotation.excerpt,
    color: (annotation.highlightColor ?? "apricot") as HighlightColor,
    locator: annotation.locator,
    createdAt: annotation.createdAt,
    updatedAt: annotation.updatedAt,
  };
}

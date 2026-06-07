// Server sync: applying a fresh GET snapshot, replaying the pending queue
// against the API, the on-the-wire shape conversion, and the retry/backoff
// policy for transient failures.
//
// Each in-memory state change is mirrored to Dexie immediately so a tab
// crash or reload doesn't lose the post-ack snapshot or leave a flushed
// mutation in the queue.

import {
  cancelRetry,
  notifyDrop,
  persist,
  scheduleRetry,
  trackPersist,
} from "../shared/bucket-core";
import {
  extractReason,
  isPermanentStatus,
  isTransientStatus,
} from "../shared/http";
import { getOrCreateBucket } from "./bucket";
import {
  removePendingMutation,
  removeSnapshotRow,
  replaceSnapshot,
  upsertSnapshotRow,
} from "./storage";
import {
  STORAGE_VERSION,
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

// Replaces the server snapshot from a fresh GET. Pending mutations are kept
// — they may not have been acked yet.
export function applyServerSnapshot(
  libraryItemId: string,
  apiBaseUrl: string,
  snapshot: HighlightRecord[],
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  bucket.state = {
    version: STORAGE_VERSION,
    snapshot,
    pending: bucket.state.pending,
  };
  persist(bucket);
  // Mirror the new authoritative snapshot to Dexie. Async; the in-memory
  // state is already current for any synchronous read.
  trackPersist(bucket, () => replaceSnapshot(libraryItemId, snapshot));
}

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
export async function flushBucket(
  libraryItemId: string,
  apiBaseUrl: string,
): Promise<void> {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  if (bucket.flushing) {
    return;
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  if (!bucket.getToken) {
    return;
  }
  // Claim the in-flight slot *synchronously* before any await — otherwise a
  // second flushBucket call (e.g. the implicit one inside enqueueUpsert)
  // would pass the early-return above and we'd send the same head twice.
  bucket.flushing = true;
  // Expose the in-flight promise on the bucket so tests can await it
  // deterministically. Production code never reads it.
  const work = doFlush(libraryItemId, bucket);
  bucket.flushPromise = work.finally(() => {
    bucket.flushPromise = null;
  });
  return bucket.flushPromise;
}

async function doFlush(
  libraryItemId: string,
  bucket: StorageBucket,
): Promise<void> {
  // Now safe to await Dexie hydrate: a restored queue + an in-memory
  // enqueue can't be double-sent because the only path into this block is
  // gated by `flushing = true` set above.
  await bucket.hydratedPromise;
  cancelRetry(bucket);
  const getToken = bucket.getToken;
  if (!getToken) {
    bucket.flushing = false;
    return;
  }
  try {
    while (bucket.state.pending.length > 0) {
      const head = bucket.state.pending[0];
      const token = await getToken();
      if (!token) {
        return;
      }
      const result = await sendMutation(
        bucket.apiBaseUrl,
        libraryItemId,
        head,
        token,
      );
      if (result.kind === "retry") {
        scheduleRetry(bucket, () =>
          void flushBucket(libraryItemId, bucket.apiBaseUrl),
        );
        return;
      }
      const popped = bucket.state.pending.slice(1);
      let nextSnapshot = bucket.state.snapshot;
      if (result.kind === "upserted" && result.row) {
        const filtered = nextSnapshot.filter((row) => row.id !== head.id);
        nextSnapshot = [...filtered, result.row];
        // Mirror the post-ack snapshot row to Dexie.
        trackPersist(bucket, () =>
          upsertSnapshotRow(libraryItemId, result.row!),
        );
      } else if (result.kind === "deleted") {
        nextSnapshot = nextSnapshot.filter((row) => row.id !== head.id);
        trackPersist(bucket, () => removeSnapshotRow(libraryItemId, head.id));
      } else if (result.kind === "drop") {
        // Permanent failure. Surface to the hook so the UI can toast why,
        // then drop the mutation from the queue. We *don't* roll back the
        // optimistic local change — the user already sees it and re-applying
        // a delete to "undo" their action would be more surprising than
        // showing the toast. They can retry by clicking again.
        const event: DropEvent = {
          mutationKind: head.kind,
          highlightId: head.id,
          reason: result.reason,
        };
        notifyDrop(bucket, event);
      }
      // Whatever the outcome (success / drop), the head mutation leaves
      // the queue. Mirror that to Dexie.
      trackPersist(bucket, () => removePendingMutation(head.id));
      bucket.state = {
        ...bucket.state,
        snapshot: nextSnapshot,
        pending: popped,
      };
      persist(bucket);
      // We made progress (or cleanly discarded) — reset backoff so the next
      // transient blip doesn't inherit the previous run's long delay.
      bucket.retryDelayMs = 0;
    }
  } finally {
    bucket.flushing = false;
  }
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

// Decide whether a 4xx/5xx response is transient (retry forever) or
// permanent (drop and tell the user). We treat unknown statuses as
// retryable: silently losing data is the worst outcome, and the queue is
// idempotent so retrying a "should have been dropped" mutation just hits
// the same error again.
async function classifyFailure(response: Response): Promise<SendResult> {
  if (isTransientStatus(response.status)) {
    return { kind: "retry" };
  }
  if (isPermanentStatus(response.status)) {
    const reason = await extractReason(response);
    return { kind: "drop", reason };
  }
  // Conservatively retry anything we don't recognize.
  return { kind: "retry" };
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

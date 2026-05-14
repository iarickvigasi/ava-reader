// Server sync: applying a fresh GET snapshot, replaying the pending queue
// against the API, and the on-the-wire shape conversion.

import { getOrCreateBucket, persist } from "./bucket";
import {
  STORAGE_VERSION,
  type HighlightColor,
  type HighlightRecord,
  type PendingMutation,
  type ServerAnnotation,
} from "./types";

type SendResult =
  | "retry"
  | { kind: "upserted"; row: HighlightRecord | null }
  | { kind: "deleted" }
  | { kind: "drop" };

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
  persist(libraryItemId, bucket);
}

// Tries to drain the pending queue head-first. One in-flight at a time per
// bucket so the server sees mutations in order. On 5xx / network error we
// stop and leave the queue intact — the next online/visibility event will
// retry. On 4xx (other than 401/429) we drop the mutation: the server
// rejected the data and retrying won't help.
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
  bucket.flushing = true;
  try {
    while (bucket.state.pending.length > 0) {
      const head = bucket.state.pending[0];
      const token = await bucket.getToken();
      if (!token) {
        return;
      }
      const result = await sendMutation(
        bucket.apiBaseUrl,
        libraryItemId,
        head,
        token,
      );
      if (result === "retry") {
        return;
      }
      // success or drop — pop the head and apply to snapshot.
      const popped = bucket.state.pending.slice(1);
      let nextSnapshot = bucket.state.snapshot;
      if (result.kind === "upserted" && result.row) {
        const filtered = nextSnapshot.filter((row) => row.id !== head.id);
        nextSnapshot = [...filtered, result.row];
      } else if (result.kind === "deleted") {
        nextSnapshot = nextSnapshot.filter((row) => row.id !== head.id);
      }
      bucket.state = {
        ...bucket.state,
        snapshot: nextSnapshot,
        pending: popped,
      };
      persist(libraryItemId, bucket);
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
      if (response.ok || response.status === 404) {
        return { kind: "deleted" };
      }
      if (response.status >= 500 || response.status === 408) {
        return "retry";
      }
      return { kind: "drop" };
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
    if (response.status >= 500 || response.status === 408) {
      return "retry";
    }
    return { kind: "drop" };
  } catch {
    // Network failure (offline, DNS, etc.). Always retryable.
    return "retry";
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

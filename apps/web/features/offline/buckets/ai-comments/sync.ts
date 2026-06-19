// Server sync: applies a fresh GET snapshot and drains the pending queue
// against the API. Mirrors the highlights sync layer but with two extra
// concerns:
//   - Generation calls stream their response — we read the body chunk by
//     chunk and append into the Dexie row + in-memory state as it arrives
//     so the user sees text "typing in." Status flips queued → streaming
//     → ready.
//   - Server already de-duplicates by (userId, sourceHash). A queued
//     generate re-posted after a tab crash returns the cached body, not a
//     duplicate.
//
// Retry / drop classification matches highlights.

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
  markCommentFailed,
  patchCommentStatus,
  removePendingMutation,
  replaceSnapshot,
  removeCommentRow,
  upsertCommentRow,
} from "./storage";
import type {
  AiCommentRecord,
  PendingMutation,
  ServerAiComment,
  StorageBucket,
} from "./types";

type SendResult =
  | { kind: "retry" }
  | { kind: "deleted" }
  | { kind: "drop"; reason: string }
  | { kind: "generated" };

// Replace the server snapshot from a fresh GET. Pending mutations are kept
// — they may not have been acked yet.
export function applyServerSnapshot(
  libraryItemId: string,
  apiBaseUrl: string,
  snapshot: ServerAiComment[],
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  const records: AiCommentRecord[] = snapshot.map((row) => ({
    ...row,
    status: "ready",
    error: null,
  }));
  bucket.state = {
    snapshot: records,
    pending: bucket.state.pending,
  };
  persist(bucket);
  trackPersist(bucket, () => replaceSnapshot(libraryItemId, records));
}

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
  await bucket.hydratedPromise;
  cancelRetry(bucket);
  const getToken = bucket.getToken;
  if (!getToken) {
    bucket.flushing = false;
    return;
  }
  try {
    while (bucket.state.pending.length > 0) {
      const head = bucket.state.pending[0]!;
      const token = await getToken();
      if (!token) {
        return;
      }
      const result = await sendMutation(
        bucket.apiBaseUrl,
        libraryItemId,
        head,
        token,
        bucket,
      );
      if (result.kind === "retry") {
        scheduleRetry(bucket, () =>
          void flushBucket(libraryItemId, bucket.apiBaseUrl),
        );
        return;
      }
      const popped = bucket.state.pending.slice(1);
      let nextSnapshot = bucket.state.snapshot;
      if (result.kind === "deleted") {
        nextSnapshot = nextSnapshot.filter((row) => row.id !== head.id);
        trackPersist(bucket, () => removeCommentRow(libraryItemId, head.id));
      } else if (result.kind === "generated") {
        // The streaming handler already updated Dexie + the snapshot row.
        // Nothing extra to do here.
      } else if (result.kind === "drop") {
        if (head.kind === "delete") {
          // Deletes have no inline surface — the toast is their only feedback.
          notifyDrop(bucket, {
            mutationKind: head.kind,
            commentId: head.id,
            reason: result.reason,
          });
        } else {
          // Generate drop: keep the placeholder row, mark it failed and stash
          // the reason on it. The panel renders that reason inline (with a
          // Try again button), so we deliberately don't also fire a toast.
          trackPersist(bucket, () =>
            markCommentFailed(libraryItemId, head.id, result.reason),
          );
          nextSnapshot = nextSnapshot.map((row) =>
            row.id === head.id
              ? { ...row, status: "failed" as const, error: result.reason }
              : row,
          );
        }
      }
      trackPersist(bucket, () => removePendingMutation(head.id));
      bucket.state = {
        ...bucket.state,
        snapshot: nextSnapshot,
        pending: popped,
      };
      persist(bucket);
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
  bucket: StorageBucket,
): Promise<SendResult> {
  if (mutation.kind === "delete") {
    return sendDelete(apiBaseUrl, libraryItemId, mutation.id, token);
  }
  return sendGenerate(apiBaseUrl, libraryItemId, mutation, token, bucket);
}

async function sendDelete(
  apiBaseUrl: string,
  libraryItemId: string,
  id: string,
  token: string,
): Promise<SendResult> {
  const url = `${apiBaseUrl}/api/library/${encodeURIComponent(
    libraryItemId,
  )}/ai-comments/${encodeURIComponent(id)}`;
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok || response.status === 404) {
      return { kind: "deleted" };
    }
    return classifyFailure(response);
  } catch {
    return { kind: "retry" };
  }
}

async function sendGenerate(
  apiBaseUrl: string,
  libraryItemId: string,
  mutation: Extract<
    PendingMutation,
    {
      kind:
        | "generate.translate"
        | "generate.etymology"
        | "generate.explain";
    }
  >,
  token: string,
  bucket: StorageBucket,
): Promise<SendResult> {
  const kindPath = mutation.kind.split(".")[1]!;
  const url = `${apiBaseUrl}/api/library/${encodeURIComponent(
    libraryItemId,
  )}/ai-comments/${kindPath}`;
  // Ensure a placeholder row exists in Dexie + snapshot so the streaming
  // handler can patch the same row. The selectors merge produces one for
  // queued mutations; for in-flight rows we add it to the snapshot too.
  const placeholder: AiCommentRecord = {
    id: mutation.id,
    kind:
      mutation.kind === "generate.translate"
        ? "TRANSLATE"
        : mutation.kind === "generate.etymology"
          ? "ETYMOLOGY"
          : "EXPLAIN",
    sourceText: mutation.payload.text,
    body: "",
    targetLang:
      mutation.kind === "generate.translate"
        ? mutation.payload.targetLang
        : null,
    locator: mutation.locator,
    createdAt: mutation.queuedAt,
    status: "streaming",
    error: null,
  };
  bucket.state = {
    ...bucket.state,
    snapshot: [
      ...bucket.state.snapshot.filter((row) => row.id !== mutation.id),
      placeholder,
    ],
  };
  persist(bucket);
  trackPersist(bucket, () => upsertCommentRow(libraryItemId, placeholder));

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/plain",
      },
      body: JSON.stringify(mutation.payload),
    });
  } catch {
    return { kind: "retry" };
  }

  if (!response.ok) {
    return classifyFailure(response);
  }
  if (!response.body) {
    return { kind: "retry" };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      accumulated += decoder.decode();
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    accumulated += chunk;
    // Patch the in-memory + Dexie row as the body grows. The UI sees the
    // text "type in" character by character on every render.
    bucket.state = {
      ...bucket.state,
      snapshot: bucket.state.snapshot.map((row) =>
        row.id === mutation.id ? { ...row, body: accumulated } : row,
      ),
    };
    persist(bucket);
    trackPersist(bucket, () =>
      patchCommentStatus(libraryItemId, mutation.id, "streaming", chunk),
    );
  }

  // Mark ready in both stores.
  bucket.state = {
    ...bucket.state,
    snapshot: bucket.state.snapshot.map((row) =>
      row.id === mutation.id
        ? { ...row, body: accumulated, status: "ready" as const }
        : row,
    ),
  };
  persist(bucket);
  trackPersist(bucket, () =>
    patchCommentStatus(libraryItemId, mutation.id, "ready"),
  );
  return { kind: "generated" };
}

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

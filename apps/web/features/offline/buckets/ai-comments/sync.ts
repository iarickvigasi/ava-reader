// Server sync: applies a fresh GET snapshot and drains the pending queue
// against the API. The queue-drain loop, backoff, and snapshot-apply live in
// ../shared/sync-core; this module supplies the ai-comments-specific network
// calls and result-application. Two extra concerns vs highlights:
//   - Generation calls stream their response — we read the body chunk by
//     chunk and append into the Dexie row + in-memory state as it arrives
//     so the user sees text "typing in." Status flips queued → streaming
//     → ready.
//   - Server already de-duplicates by (userId, sourceHash). A queued
//     generate re-posted after a tab crash returns the cached body, not a
//     duplicate.
//
// Retry / drop classification matches highlights.

import { notifyDrop, persist, trackPersist } from "../shared/bucket-core";
import { classifyFailure } from "../shared/http";
import { createSyncRuntime } from "../shared/sync-core";
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

const runtime = createSyncRuntime<
  AiCommentRecord,
  PendingMutation,
  SendResult,
  ServerAiComment,
  StorageBucket
>({
  getOrCreateBucket,
  send: (bucket, libraryItemId, head, token) =>
    sendMutation(bucket.apiBaseUrl, libraryItemId, head, token, bucket),
  applyTerminal,
  removePendingMutation,
  // Server rows arrive without a status — they're all confirmed/ready.
  toRecords: (snapshot) =>
    snapshot.map((row) => ({ ...row, status: "ready" as const, error: null })),
  replaceSnapshot,
});

export const { applyServerSnapshot, flushBucket } = runtime;

function applyTerminal(
  bucket: StorageBucket,
  libraryItemId: string,
  head: PendingMutation,
  result: SendResult,
): AiCommentRecord[] {
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
  return nextSnapshot;
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
  try {
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
  } catch {
    // Connection dropped mid-stream. Retry rather than letting the throw
    // escape the flush loop (which would stall the queue with no reschedule).
    // The next attempt re-streams from scratch — the placeholder re-write
    // resets the row, and the server's sourceHash dedupe avoids a duplicate.
    return { kind: "retry" };
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

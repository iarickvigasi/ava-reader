// Read paths. `selectAiComments` merges snapshot + pending into the array
// the UI renders; `selectStableAiComments` caches against `version` so
// useSyncExternalStore sees referential equality between unrelated renders.
//
// Merge rules:
//   - Snapshot rows (server-confirmed) provide the baseline list.
//   - Pending deletes hide the matching snapshot row.
//   - Pending generate-mutations either reveal a brand-new placeholder
//     row (if no snapshot row with the same id) or are ignored (the
//     snapshot already has the post-ack content).

import type {
  AiCommentKind,
  AiCommentRecord,
  PendingMutation,
  StorageBucket,
} from "./types";

export function selectAiComments(bucket: StorageBucket): AiCommentRecord[] {
  const byId = new Map<string, AiCommentRecord>();
  for (const row of bucket.state.snapshot) {
    byId.set(row.id, row);
  }
  for (const mutation of bucket.state.pending) {
    if (mutation.kind === "delete") {
      byId.delete(mutation.id);
      continue;
    }
    if (byId.has(mutation.id)) {
      // Server snapshot already reflects this id — the pending generate is
      // stale (e.g. we hydrated faster than we drained). Ignore.
      continue;
    }
    byId.set(mutation.id, generatePlaceholder(mutation));
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function selectStableAiComments(
  bucket: StorageBucket,
): AiCommentRecord[] {
  if (bucket.derivedVersion === bucket.version) {
    return bucket.derived;
  }
  bucket.derived = selectAiComments(bucket);
  bucket.derivedVersion = bucket.version;
  return bucket.derived;
}

function generatePlaceholder(
  mutation: Extract<
    PendingMutation,
    {
      kind:
        | "generate.translate"
        | "generate.etymology"
        | "generate.explain";
    }
  >,
): AiCommentRecord {
  const kind: AiCommentKind =
    mutation.kind === "generate.translate"
      ? "TRANSLATE"
      : mutation.kind === "generate.etymology"
        ? "ETYMOLOGY"
        : "EXPLAIN";
  const targetLang =
    mutation.kind === "generate.translate" ? mutation.payload.targetLang : null;
  return {
    id: mutation.id,
    kind,
    sourceText: mutation.payload.text,
    body: "",
    targetLang,
    locator: mutation.locator,
    createdAt: mutation.queuedAt,
    status: "queued",
  };
}

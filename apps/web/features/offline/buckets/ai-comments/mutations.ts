// Write paths. enqueueGenerate / enqueueDelete are the only functions that
// append to the pending queue, and the only ones that kick a flush.
//
// Same coalesce rule as highlights: at most one pending mutation per id at
// a time. A delete for an id that has only a queued generate (never reached
// the server) collapses both — nothing to send.

import { createMutations } from "../shared/mutations-core";
import { getOrCreateBucket } from "./bucket";
import {
  removePendingMutation,
  upsertPendingMutation,
} from "./storage";
import { flushBucket } from "./sync";
import type { PendingMutation, StorageBucket } from "./types";

type GenerateMutation = Extract<
  PendingMutation,
  { kind: "generate.translate" | "generate.etymology" | "generate.explain" }
>;

const { commit, enqueueDelete } = createMutations<PendingMutation, StorageBucket>(
  {
    getOrCreateBucket,
    upsertPendingMutation,
    removePendingMutation,
    flushBucket,
  },
);

export { enqueueDelete };

// Content identity of a generate request: tool + source text + target lang.
// The server dedupes on this same tuple (sourceHash), so two requests that
// share it are the same comment. The reader mints a fresh client id every
// time the toolbox effect re-runs (e.g. reopening a panel offline), so we
// coalesce on content — not id — to keep a single queued comment.
function requestSignature(mutation: GenerateMutation): string {
  const targetLang =
    mutation.kind === "generate.translate" ? mutation.payload.targetLang : "";
  return `${mutation.kind} ${mutation.payload.text} ${targetLang}`;
}

export function enqueueGenerate(
  libraryItemId: string,
  apiBaseUrl: string,
  mutation: GenerateMutation,
) {
  const bucket = getOrCreateBucket(libraryItemId, apiBaseUrl);
  // An identical request is already queued — keep it instead of piling up a
  // second placeholder under a new client id (see spec 5.3-ai-comments, Edge
  // cases). A re-run of the offline toolbox effect is a no-op.
  const signature = requestSignature(mutation);
  const alreadyQueued = bucket.state.pending.some(
    (m) => m.kind !== "delete" && requestSignature(m) === signature,
  );
  if (alreadyQueued) {
    return;
  }
  // Coalesce against any existing pending row with the same id.
  commit(libraryItemId, apiBaseUrl, mutation);
}

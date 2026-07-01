// Write paths into the bucket. These are the only functions that should
// append to the pending queue, and the only ones that kick a flush.
//
// Each call updates the in-memory state synchronously (so the UI repaints
// immediately), then mirrors the change to Dexie. The Dexie write is
// fire-and-forget — a failure leaves the in-memory state untouched and the
// next mutation overwrites the row anyway. The flush is also fire-and-forget
// (the bucket awaits its `hydratedPromise` internally before sending so a
// queue restored from a previous session doesn't get double-sent).

import type { ReaderRangeLocator } from "@/lib/api-types";

import { createMutations } from "../shared/mutations-core";
import { getOrCreateBucket } from "./bucket";
import {
  removePendingMutation,
  upsertPendingMutation,
} from "./storage";
import { flushBucket } from "./sync";
import type { HighlightColor, PendingMutation, StorageBucket } from "./types";

const { commit, enqueueDelete } = createMutations<PendingMutation, StorageBucket>(
  {
    getOrCreateBucket,
    upsertPendingMutation,
    removePendingMutation,
    flushBucket,
  },
);

export { enqueueDelete };

export function enqueueUpsert(
  libraryItemId: string,
  apiBaseUrl: string,
  input: {
    id: string;
    excerpt: string;
    color: HighlightColor;
    locator: ReaderRangeLocator | null;
  },
) {
  const next: PendingMutation = {
    kind: "upsert",
    id: input.id,
    payload: {
      excerpt: input.excerpt,
      highlightColor: input.color,
      locator: input.locator,
    },
    queuedAt: new Date().toISOString(),
  };
  // Coalesce against any existing pending row for this id — we only ever need
  // to send the final state to the server.
  commit(libraryItemId, apiBaseUrl, next);
}

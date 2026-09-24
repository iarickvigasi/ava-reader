import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb } from "./db";
import * as highlights from "./buckets/highlights";
import * as comments from "./buckets/ai-comments";
import {
  flushCollectionMemberships,
  flushFinishDates,
} from "./buckets/library";
import { flushDirtyProgress } from "./buckets/progress";
import { flushPreferences } from "./buckets/preferences";
import { syncPendingSessions } from "./buckets/sessions";
import { getOrCreateReaderClientInstanceId } from "@/components/app/reader/data/reader-client-instance-id";

let running: Promise<void> | null = null;

// Resume persisted queues even when reauthentication lands on home, without
// requiring the reader to reopen every book containing unsynced annotations.
export function resumePendingWork(getToken: () => Promise<string | null>) {
  if (running) return running;
  running = resume(getToken).finally(() => {
    running = null;
  });
  return running;
}

async function resume(getToken: () => Promise<string | null>) {
  const db = getDb();
  if (!navigator.onLine || !(await getToken()) || db !== getDb()) return;
  const [highlightRows, commentRows] = await Promise.all([
    db.highlightMutations.toArray(),
    db.aiCommentMutations.toArray(),
  ]);
  if (db !== getDb()) return;
  const api = getPublicApiBaseUrl();
  await Promise.allSettled([
    flushDirtyProgress(getToken),
    flushPreferences(getToken),
    flushCollectionMemberships(getToken),
    flushFinishDates(getToken),
    syncPendingSessions(getToken, getOrCreateReaderClientInstanceId()),
    ...[...new Set(highlightRows.map((row) => row.scopeId))].map((id) => {
      highlights.setBucketAuth(id, api, getToken);
      return highlights.flushBucket(id, api);
    }),
    ...[...new Set(commentRows.map((row) => row.scopeId))].map((id) => {
      comments.setBucketAuth(id, api, getToken);
      return comments.flushBucket(id, api);
    }),
  ]);
}

import { withDeadline } from "@/features/auth/with-deadline";
import { isOnline } from "@/features/offline/net/net-state";
import { getPublicApiBaseUrl } from "@/lib/api";
import { getDb, type AvaReaderDB } from "./db";
import * as highlights from "./buckets/highlights";
import * as comments from "./buckets/ai-comments";
import {
  flushCollectionMemberships,
  flushFinishDates,
  flushCatalogLinks,
} from "./buckets/library";
import { flushDirtyProgress } from "./buckets/progress";
import { flushPreferences } from "./buckets/preferences";
import { syncPendingSessions } from "./buckets/sessions";

type GetToken = () => Promise<string | null>;
type AnnotationBucket = Pick<
  typeof highlights,
  "setBucketAuth" | "flushBucket"
>;
const running = new WeakMap<AvaReaderDB, Promise<void>>();

// Resume persisted queues even when reauthentication lands on home, without
// requiring the reader to reopen every book containing unsynced annotations.
export function resumePendingWork(getToken: GetToken) {
  const db = getDb();
  const prior = running.get(db);
  if (prior) return prior;
  const work = resumeQueues(db, getToken).finally(() => running.delete(db));
  running.set(db, work);
  return work;
}

async function resumeQueues(db: AvaReaderDB, getToken: GetToken) {
  if (!isOnline() || !(await withDeadline(getToken())) || db !== getDb())
    return;
  const { highlightScopes, commentScopes } =
    await readPendingAnnotationScopes(db);
  if (db !== getDb()) return;
  await withDeadline(
    Promise.allSettled([
      flushDirtyProgress(getToken),
      flushPreferences(getToken),
      flushCollectionMemberships(getToken),
      flushFinishDates(getToken),
      flushCatalogLinks(getToken),
      syncPendingSessions(getToken),
      ...flushAnnotationScopes(highlights, highlightScopes, getToken),
      ...flushAnnotationScopes(comments, commentScopes, getToken),
    ]),
  );
}

async function readPendingAnnotationScopes(db: AvaReaderDB) {
  const [highlightRows, commentRows] = await Promise.all([
    db.highlightMutations.toArray(),
    db.aiCommentMutations.toArray(),
  ]);
  return {
    highlightScopes: [...new Set(highlightRows.map((row) => row.scopeId))],
    commentScopes: [...new Set(commentRows.map((row) => row.scopeId))],
  };
}

function flushAnnotationScopes(
  bucket: AnnotationBucket,
  scopeIds: string[],
  getToken: GetToken,
) {
  const api = getPublicApiBaseUrl();
  return scopeIds.map((id) => {
    bucket.setBucketAuth(id, api, getToken);
    return bucket.flushBucket(id, api);
  });
}

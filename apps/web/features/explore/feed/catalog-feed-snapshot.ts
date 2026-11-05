import { getDb } from "@/features/offline/db";
import type {
  FeedAnchor,
  FeedLoaded,
  FeedRequest,
  FeedSnapshot,
} from "./types";
const snapshots = new WeakMap<object, Map<string, FeedSnapshot>>();

export function readFeedSnapshot(key: string) {
  try {
    const saved = snapshots.get(getDb())?.get(key);
    return saved && Date.now() - saved.savedAt < 30 * 60_000 ? saved : null;
  } catch {
    return null;
  }
}

export function saveFeedSnapshot(
  request: FeedRequest,
  loaded: FeedLoaded,
  scroll: number,
  anchor?: FeedAnchor,
) {
  try {
    const db = getDb();
    const cache = snapshots.get(db) ?? new Map<string, FeedSnapshot>();
    cache.delete(request.key);
    cache.set(request.key, {
      request,
      loaded,
      scroll,
      anchor,
      savedAt: Date.now(),
    });
    while (cache.size > 3) cache.delete(cache.keys().next().value!);
    snapshots.set(db, cache);
  } catch {
    /* Public navigation state is optional before identity hydration. */
  }
}

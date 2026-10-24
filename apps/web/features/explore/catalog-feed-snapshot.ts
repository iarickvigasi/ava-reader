import type { FeedAnchor } from "./feed-position";
import { getDb } from "@/features/offline/db";
import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";
import type { LoadedCatalogPage } from "./merge-catalog-pages";

export type FeedRequest = {
  key: string;
  cursor: string | null;
  limit: number;
  before?: string;
};
export type FeedLoaded = {
  key: string;
  pages: LoadedCatalogPage[];
  latest: CatalogPage<CatalogWork>;
  cursor: string | null;
  before?: string;
};
type Snapshot = {
  request: FeedRequest;
  loaded: FeedLoaded;
  scroll: number;
  anchor?: FeedAnchor;
  savedAt: number;
};
const snapshots = new WeakMap<object, Map<string, Snapshot>>();

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
    const cache = snapshots.get(db) ?? new Map<string, Snapshot>();
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

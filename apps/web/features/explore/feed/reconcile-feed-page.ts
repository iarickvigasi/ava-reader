import type { FeedLoaded, FeedPageReconciliation } from "./types";
import { mergeFeedWindow } from "./merge-feed-window";
export function reconcileFeedPage({
  loaded,
  request,
  page,
  protectedIds,
}: FeedPageReconciliation): FeedLoaded | null {
  if (!request || !page) return loaded;
  if (
    loaded?.key === request.key &&
    loaded.latest === page &&
    loaded.cursor === request.cursor &&
    loaded.before === request.before
  )
    return loaded;
  return {
    key: request.key,
    latest: page,
    cursor: request.cursor,
    before: request.before,
    pages: mergeFeedWindow(
      loaded?.key === request.key ? loaded.pages : [],
      { cursor: request.cursor, before: request.before, page },
      protectedIds,
    ),
  };
}

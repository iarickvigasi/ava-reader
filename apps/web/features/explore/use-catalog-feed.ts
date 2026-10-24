import type { GridRestorer } from "./restore-virtual-grid";
import { catalogFeedPath } from "./catalog-feed-path";
import { useMemo, useState } from "react";
import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";
import {
  readFeedSnapshot,
  type FeedLoaded,
  type FeedRequest,
} from "./catalog-feed-snapshot";
import { useFeedRestoration } from "./use-feed-restoration";
import { useCatalogResource } from "./use-catalog-resource";
import { uniqueCatalogWorks } from "./merge-catalog-pages";
import {
  FEED_PAGE_LIMIT,
  mergeFeedWindow,
  trimFeedWindow,
} from "./merge-feed-window";

export function useCatalogFeed(
  key: string,
  size: { first: number; next: number } | null,
  protectedIds: readonly string[] = [],
  restoreRef?: GridRestorer,
) {
  const [request, setRequest] = useState<FeedRequest | null>(
    () => readFeedSnapshot(key)?.request ?? null,
  );
  const [loaded, setLoaded] = useState<FeedLoaded | null>(
    () => readFeedSnapshot(key)?.loaded ?? null,
  );
  if (size && request?.key !== key) {
    const saved = readFeedSnapshot(key);
    setRequest(saved?.request ?? { key, cursor: null, limit: size.first });
    setLoaded(saved?.loaded ?? null);
  }
  useFeedRestoration(request, loaded, restoreRef);
  const active = request?.key === key ? request : null;
  const result = useCatalogResource<CatalogPage<CatalogWork>>(
    catalogFeedPath(key, active),
  );
  if (
    active &&
    result.data &&
    (loaded?.key !== key ||
      loaded.latest !== result.data ||
      loaded.cursor !== active.cursor ||
      loaded.before !== active.before)
  ) {
    setLoaded({
      key,
      latest: result.data,
      cursor: active.cursor,
      before: active.before,
      pages: mergeFeedWindow(
        loaded?.key === key ? loaded.pages : [],
        { cursor: active.cursor, before: active.before, page: result.data },
        protectedIds,
      ),
    });
  }
  const pages = useMemo(
    () => (loaded?.key === key ? loaded.pages : []),
    [loaded, key],
  );
  const items = useMemo(() => uniqueCatalogWorks(pages), [pages]);
  const next = pages.at(-1)?.page.nextCursor;
  const previous = pages[0]?.page.previousCursor;
  const load = (backward: boolean) => {
    if (
      !size ||
      result.loading ||
      result.error ||
      pages.length > FEED_PAGE_LIMIT
    )
      return;
    const boundary = backward ? previous : next;
    if (boundary)
      setRequest({
        key,
        cursor: backward ? null : boundary,
        before: backward ? boundary : undefined,
        limit: size.next,
      });
  };
  if (loaded?.key === key && loaded.pages.length > FEED_PAGE_LIMIT) {
    const trimmed = trimFeedWindow(loaded.pages, !!loaded.before, protectedIds);
    if (trimmed.length !== loaded.pages.length)
      setLoaded({ ...loaded, pages: trimmed });
  }
  return {
    ...result,
    items,
    hasNext: !!next,
    hasPrevious: !!previous,
    loading: !active || result.loading,
    loadMore: () => load(false),
    loadPrevious: () => load(true),
  };
}

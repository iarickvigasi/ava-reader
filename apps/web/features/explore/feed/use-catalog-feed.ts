import { nextFeedRequest } from "./next-feed-request";
import type { GridRestorer } from "../grid/types";
import { catalogFeedPath } from "./catalog-feed-path";
import { useMemo, useState } from "react";
import type { CatalogPage, CatalogWork } from "@/lib/catalog-types";
import { readFeedSnapshot } from "./catalog-feed-snapshot";
import type { FeedLoaded, FeedRequest } from "./types";
import { useFeedRestoration } from "./restoration/use-feed-restoration";
import { useCatalogResource } from "../data/use-catalog-resource";
import { uniqueCatalogWorks } from "./unique-catalog-works";
import { reconcileFeedPage } from "./reconcile-feed-page";
import { FEED_PAGE_LIMIT } from "./constants";
import { trimFeedWindow } from "./trim-feed-window";

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
  const reconciled = reconcileFeedPage({
    loaded,
    request: active,
    page: result.data,
    protectedIds,
  });
  if (reconciled !== loaded) setLoaded(reconciled);
  const pages = useMemo(
    () => (loaded?.key === key ? loaded.pages : []),
    [loaded, key],
  );
  const items = useMemo(() => uniqueCatalogWorks(pages), [pages]);
  const next = pages.at(-1)?.page.nextCursor;
  const previous = pages[0]?.page.previousCursor;
  const load = (backward: boolean) => {
    const nextRequest = nextFeedRequest({
      key,
      size,
      pages,
      backward,
      loading: result.loading,
      error: result.error,
    });
    if (nextRequest) setRequest(nextRequest);
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

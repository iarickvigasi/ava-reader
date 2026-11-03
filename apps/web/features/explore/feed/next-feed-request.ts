import type { FeedRequest, FeedPagingOptions } from "./types";
import { FEED_PAGE_LIMIT } from "./constants";
export function nextFeedRequest({
  key,
  size,
  pages,
  backward,
  loading,
  error,
}: FeedPagingOptions): FeedRequest | null {
  if (!size || loading || error || pages.length > FEED_PAGE_LIMIT) return null;
  const boundary = backward
    ? pages[0]?.page.previousCursor
    : pages.at(-1)?.page.nextCursor;
  return boundary
    ? {
        key,
        cursor: backward ? null : boundary,
        before: backward ? boundary : undefined,
        limit: size.next,
      }
    : null;
}

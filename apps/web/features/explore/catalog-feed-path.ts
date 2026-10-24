import type { FeedRequest } from "./catalog-feed-snapshot";

export function catalogFeedPath(key: string, request: FeedRequest | null) {
  if (!request) return null;
  const params = new URLSearchParams(key);
  params.set("limit", String(request.limit));
  if (request.cursor) params.set("cursor", request.cursor);
  if (request.before) params.set("before", request.before);
  return `works?${params}`;
}

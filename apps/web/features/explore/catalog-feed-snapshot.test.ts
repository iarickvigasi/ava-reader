import { afterEach, expect, it, vi } from "vitest";
import {
  readFeedSnapshot,
  saveFeedSnapshot,
  type FeedLoaded,
} from "./catalog-feed-snapshot";

const owner = vi.hoisted(() => ({ db: {} }));
vi.mock("@/features/offline/db", () => ({ getDb: () => owner.db }));
afterEach(() => {
  owner.db = {};
  vi.useRealTimers();
});
const loaded: FeedLoaded = {
  key: "query=Alice",
  pages: [{ cursor: null, page: { items: [], nextCursor: "next" } }],
  latest: { items: [], nextCursor: "next" },
  cursor: null,
};

it("restores accumulated pages, request boundary, and scroll only for the same account", () => {
  const request = { key: loaded.key, cursor: "next", limit: 12 };
  saveFeedSnapshot(request, loaded, 1500);
  expect(readFeedSnapshot(loaded.key)).toMatchObject({
    request,
    loaded,
    scroll: 1500,
  });
  owner.db = {};
  expect(readFeedSnapshot(loaded.key)).toBeNull();
});
it("expires old navigation snapshots and bounds query history", () => {
  vi.useFakeTimers();
  for (let index = 0; index < 4; index++) {
    const key = String(index);
    saveFeedSnapshot({ key, cursor: null, limit: 12 }, { ...loaded, key }, 10);
  }
  expect(readFeedSnapshot("0")).toBeNull();
  expect(readFeedSnapshot("3")).not.toBeNull();
  vi.advanceTimersByTime(30 * 60_000 + 1);
  expect(readFeedSnapshot("3")).toBeNull();
});

// @vitest-environment jsdom
import { Activity, act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { readFeedSnapshot, saveFeedSnapshot } from "../catalog-feed-snapshot";
import type { FeedLoaded } from "../types";
import { useFeedRestoration } from "./use-feed-restoration";

vi.mock("@/features/offline/db", () => ({ getDb: () => owner }));
const owner = {};
const request = { key: "query=Alice", cursor: null, limit: 12 };
const loaded: FeedLoaded = {
  key: request.key,
  cursor: null,
  pages: [],
  latest: { items: [], nextCursor: null },
};
const restore = vi.fn(() => vi.fn());
const restoreRef = { current: restore };
const container = document.createElement("div");
let root: ReturnType<typeof createRoot>;

function Feed() {
  useFeedRestoration(request, loaded, restoreRef);
  return null;
}

afterEach(async () => {
  await act(() => root.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("restores again after Activity reactivation and records the new departure once", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  saveFeedSnapshot(request, loaded, 1500);
  root = createRoot(container);
  await act(() =>
    root.render(
      <Activity mode="visible">
        <Feed />
      </Activity>,
    ),
  );
  expect(restore).toHaveBeenLastCalledWith(1500, undefined);

  await act(() =>
    root.render(
      <Activity mode="hidden">
        <Feed />
      </Activity>,
    ),
  );
  await act(() =>
    root.render(
      <Activity mode="visible">
        <Feed />
      </Activity>,
    ),
  );
  expect(restore).toHaveBeenCalledTimes(2);
  expect(restore.mock.results[0].value).toHaveBeenCalledOnce();

  Object.defineProperty(window, "scrollY", { configurable: true, value: 2100 });
  window.dispatchEvent(new Event("scroll"));
  window.dispatchEvent(new PopStateEvent("popstate"));
  expect(readFeedSnapshot(request.key)?.scroll).toBe(2100);
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  window.dispatchEvent(new PopStateEvent("popstate"));
  expect(readFeedSnapshot(request.key)?.scroll).toBe(2100);
});

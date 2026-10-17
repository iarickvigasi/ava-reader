import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReaderMeasurementEntry } from "@/features/reader/measurement";
import { resolvePageResolutionForLocator } from "./resolve-measurement";
import {
  resetMeasurementRuntime,
  renderMeasurementRuntime,
  retainedEntryCount,
} from "./measurement-cache-test-runtime";

beforeEach(resetMeasurementRuntime);
afterEach(() => vi.restoreAllMocks());
const keys = (active: string, previous: string | null = null) => ({
  activePaginationLayoutKey: active,
  previousPaginationLayoutKey: previous,
});
function ready(layoutKey: string, pages = 7) {
  const article = { isConnected: true },
    pageBox = { isConnected: true };
  let owner = article;
  const resolvePageIndex = vi.fn(() => {
    // A resolver deliberately captures its originating DOM, like the real builder.
    expect(article.isConnected && pageBox.isConnected).toBe(true);
    return { status: "exact", column: 1, pageIndex: 3 } as const;
  });
  const entry = {
    chapterId: layoutKey.split(":")[0],
    layoutKey,
    pageCount: pages,
    status: "ready",
    isCurrent: () =>
      article.isConnected && pageBox.isConnected && owner === article,
    resolveLocator: () => ({
      chapterId: "a",
      blockId: "a::paragraph",
      textOffset: 14,
    }),
    resolvePageIndex,
  } as ReaderMeasurementEntry;
  return {
    entry,
    article,
    resolvePageIndex,
    replaceOwner: () => {
      owner = { isConnected: true };
    },
  };
}
it("retains the active and connected previous page counts but releases unrelated cold chapters", () => {
  let view = renderMeasurementRuntime(keys("a:wide", "p:wide"));
  for (const key of ["p:wide", "a:wide", "next:wide", "cold:wide"])
    view.storeMeasurementEntry(ready(key, key === "p:wide" ? 2 : 7).entry);
  view = renderMeasurementRuntime(keys("a:wide", "p:wide"));
  expect(view.pageCount).toBe(7);
  expect(view.previousChapterPageCount).toBe(2);
  expect(retainedEntryCount()).toBe(2);
  view = renderMeasurementRuntime(keys("cold:wide"));
  expect(view.activeReadyMeasurementEntry).toBeNull();
  expect(retainedEntryCount()).toBe(0);
});
it("does not reuse an old viewport when returning before fresh measurement", () => {
  let view = renderMeasurementRuntime(keys("a:wide"));
  const old = ready("a:wide");
  const staleStore = view.storeMeasurementEntry;
  view.storeMeasurementEntry(old.entry);
  view = renderMeasurementRuntime(keys("a:narrow"));
  expect(view.activeReadyMeasurementEntry).toBeNull();
  view = renderMeasurementRuntime(keys("a:wide"));
  staleStore(old.entry);
  view = renderMeasurementRuntime(keys("a:wide"));
  expect(view.activeMeasurementStatus).toBe("pending");
  expect(view.activeReadyMeasurementEntry).toBeNull();
  expect(old.resolvePageIndex).not.toHaveBeenCalled();
});
it.each(["disconnect", "replace"])(
  "rejects a %s owner and never resolves it as the current passage",
  (change) => {
    let view = renderMeasurementRuntime(keys("a:wide"));
    const old = ready("a:wide");
    view.storeMeasurementEntry(old.entry);
    if (change === "disconnect") old.article.isConnected = false;
    else old.replaceOwner();
    view = renderMeasurementRuntime(keys("a:wide"));
    expect(view.activeReadyMeasurementEntry).toBeNull();
    expect(view.activeMeasurementStatus).toBe("pending");
    expect(retainedEntryCount()).toBe(0);
    expect(
      resolvePageResolutionForLocator({
        activeChapterId: "a",
        locator: { chapterId: "a", blockId: "a::paragraph", textOffset: 14 },
        measurementEntry: old.entry.status === "ready" ? old.entry : null,
      }),
    ).toBeNull();
    expect(old.resolvePageIndex).not.toHaveBeenCalled();
  },
);
it("ignores a late old-scope callback and preserves exact resolution on the fresh active owner", () => {
  const old = renderMeasurementRuntime(keys("a:wide"));
  let current = renderMeasurementRuntime(keys("b:wide", "a:wide"));
  old.storeMeasurementEntry(ready("a:wide", 99).entry);
  const fresh = ready("b:wide", 4);
  current.storeMeasurementEntry(fresh.entry);
  current = renderMeasurementRuntime(keys("b:wide", "a:wide"));
  expect(current.previousChapterPageCount).toBeNull();
  expect(current.pageCount).toBe(4);
  expect(
    resolvePageResolutionForLocator({
      activeChapterId: "b",
      locator: { chapterId: "b", blockId: "b::paragraph", textOffset: 14 },
      measurementEntry: current.activeReadyMeasurementEntry,
    }),
  ).toEqual({ status: "exact", column: 1, pageIndex: 3 });
  expect(fresh.resolvePageIndex).toHaveBeenCalledOnce();
});

it("deduplicates current failures without retaining warnings from retired layouts", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const old = renderMeasurementRuntime(keys("a:wide", "p:wide"));
  old.warnFailedMeasurement("a:wide");
  old.warnFailedMeasurement("a:wide");
  old.warnFailedMeasurement("unrelated:wide");
  expect(warning).toHaveBeenCalledTimes(1);
  renderMeasurementRuntime(keys("a:narrow"));
  old.warnFailedMeasurement("p:wide");
  const fresh = renderMeasurementRuntime(keys("a:wide"));
  old.warnFailedMeasurement("a:wide");
  fresh.warnFailedMeasurement("a:wide");
  expect(warning).toHaveBeenCalledTimes(2);
});

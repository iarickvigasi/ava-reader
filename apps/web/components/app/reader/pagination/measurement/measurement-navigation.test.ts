import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ReaderChapterPayload } from "@/lib/api-types";
import { createPaginationLayoutKey } from "@/features/reader/pagination-decision";
import { resolveReadyMeasurementEntry } from "./resolve-measurement";
import {
  resetMeasurementRuntime,
  renderMeasurementRuntime,
  retainedEntryCount,
} from "./measurement-cache-test-runtime";

beforeEach(() => {
  resetMeasurementRuntime();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function preloader() {
  const articles = new Map<string, HTMLElement>(),
    boxes = new Map<string, HTMLDivElement>();
  for (const id of ["a", "b", "c"]) {
    articles.set(id, {
      isConnected: true,
      scrollWidth: id === "b" ? 700 : 400,
      children: [],
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0 }),
    } as unknown as HTMLElement);
    boxes.set(id, {
      isConnected: true,
      clientWidth: 200,
      getBoundingClientRect: () => ({ left: 0 }),
    } as HTMLDivElement);
  }
  return {
    articles,
    boxes,
    input: {
      articleRefs: { get: (id: string) => articles.get(id) ?? null },
      pageBoxRefs: { get: (id: string) => boxes.get(id) ?? null },
      chapters: ["a", "b", "c"].map((chapterId) => ({
        chapterId,
        blocks: [],
      })) as unknown as ReaderChapterPayload[],
      fontScale: 1,
      libraryItemId: "book",
      pageBoxHeight: 400,
      pageBoxWidth: 200,
    },
  };
}
function keys(active: string, previous: string | null, width = 200) {
  const key = (chapterId: string) =>
    createPaginationLayoutKey({
      chapterId,
      libraryItemId: "book",
      fontScale: 1,
      viewportHeight: 400,
      viewportWidth: width,
    });
  return {
    activePaginationLayoutKey: key(active),
    previousPaginationLayoutKey: previous ? key(previous) : null,
  };
}
it("measures the formerly-next chapter on activation with the same mounted preloader window", () => {
  const p = preloader();
  const a = renderMeasurementRuntime(keys("a", null), p.input);
  expect(a.pageCount).toBe(2);
  expect(retainedEntryCount()).toBe(1);
  const old = a.activeReadyMeasurementEntry;
  const b = renderMeasurementRuntime(keys("b", "a"), p.input);
  expect(b.activeMeasurementStatus).toBe("ready");
  expect(b.pageCount).toBe(4);
  expect(b.previousChapterPageCount).toBe(2);
  expect(retainedEntryCount()).toBe(2);
  expect(resolveReadyMeasurementEntry(old)).toBeNull();
  const back = renderMeasurementRuntime(keys("a", null), p.input);
  expect(back.pageCount).toBe(2);
  expect(back.activeReadyMeasurementEntry).not.toBe(old);
  expect(retainedEntryCount()).toBe(1);
});
it("retires a still-connected former owner and a detached cold-window chapter", () => {
  const p = preloader();
  const a = renderMeasurementRuntime(
    keys("a", null),
    p.input,
  ).activeReadyMeasurementEntry;
  const oldArticle = p.articles.get("a")!;
  p.articles.set("a", { ...oldArticle } as HTMLElement);
  expect(oldArticle.isConnected).toBe(true);
  expect(resolveReadyMeasurementEntry(a)).toBeNull();
  const fresh = renderMeasurementRuntime(keys("a", null), {
    ...p.input,
    chapters: [...p.input.chapters],
  });
  expect(fresh.activeMeasurementStatus).toBe("ready");
  Object.defineProperty(p.articles.get("a"), "isConnected", { value: false });
  p.articles.delete("a");
  p.boxes.delete("a");
  const cold = renderMeasurementRuntime(keys("c", null), {
    ...p.input,
    chapters: p.input.chapters.filter((chapter) => chapter.chapterId === "c"),
  });
  expect(cold.activeMeasurementStatus).toBe("ready");
  expect(retainedEntryCount()).toBe(1);
  expect(fresh.activeReadyMeasurementEntry?.resolveLocator(0)).toBeNull();
});

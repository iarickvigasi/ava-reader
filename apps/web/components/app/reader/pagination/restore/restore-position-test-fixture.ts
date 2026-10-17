import {
  getPositionHooks,
  renderPositionRuntime,
  resetPositionRuntime,
} from "./restore-position-test-runtime";
import type { RestoreIntent } from "@/features/reader/navigation";
import { activeChapter } from "../layout/cold-restore-test-fixture";
import { useRestoreDecision } from "./use-restore-decision";
import type { UseRestoreDecisionInput } from "./use-restore-controller.types";

export const chapter = "chapter-2";
export function fixture(
  intent: RestoreIntent | null = {
    kind: "block",
    chapterId: chapter,
    blockId: "p4-graphic0",
    textOffset: 0,
    key: "cold:figure",
  },
) {
  resetPositionRuntime();
  const frames: (() => void)[] = [],
    warnings: string[] = [];
  let dirty = false;
  const input: UseRestoreDecisionInput = {
    activeChapter: { ...activeChapter, chapterId: chapter },
    activePaginationLayoutKey: "100",
    activeRestoreCycleKey: "100",
    activeMeasurementEntry: null,
    prefixPageCount: 0,
    restoreIntent: intent,
    pageCount: 3,
    currentPageIndex: 0,
    visibleLocator: {
      chapterId: chapter,
      blockId: "p4-graphic0",
      textOffset: 0,
    },
    cancelSettle: () => {
      frames.length = 0;
    },
    scheduleSettle: (_key, callback) => {
      if (callback) frames.push(callback);
    },
    warnFailedMeasurement: (key) => warnings.push(key),
    setCurrentPageIndex: (update) => {
      const next =
        typeof update === "function" ? update(input.currentPageIndex) : update;
      if (next !== input.currentPageIndex) {
        input.currentPageIndex = next;
        dirty = true;
      }
    },
  };
  function useRenderProbe() {
    useRestoreDecision(input);
  }
  const render = () => {
    let guard = 0;
    do {
      dirty = false;
      renderPositionRuntime(useRenderProbe);
      if (++guard > 10) throw new Error("render loop");
    } while (dirty);
    frames.splice(0).forEach((callback) => callback());
  };
  const layout = (
    key: string,
    pages: number,
    map: Record<string, number>,
    first?: string[],
    failed = false,
  ) => {
    input.activePaginationLayoutKey = key;
    input.activeRestoreCycleKey = key;
    input.pageCount = pages;
    input.activeMeasurementEntry = failed
      ? { chapterId: chapter, layoutKey: key, status: "failed", pageCount: 1 }
      : {
          chapterId: chapter,
          layoutKey: key,
          status: "ready",
          pageCount: pages,
          resolveLocator: () => null,
          resolvePageIndex: (value) => ({
            status: "exact",
            column: 1,
            pageIndex: map[value.blockId] ?? 0,
          }),
        };
    render();
    if (first) {
      input.visibleLocator = {
        chapterId: chapter,
        blockId: first[input.currentPageIndex],
        textOffset: 0,
      };
      render();
    }
    return input.currentPageIndex;
  };
  const page = (index: number, blockId: string) => {
    input.currentPageIndex = index;
    render();
    input.visibleLocator = { chapterId: chapter, blockId, textOffset: 0 };
    render();
  };
  return { input, hooks: getPositionHooks(), render, layout, page, warnings };
}

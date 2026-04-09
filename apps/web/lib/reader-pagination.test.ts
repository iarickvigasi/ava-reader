import { describe, expect, it } from "vitest";
import {
  createPaginationLayoutKey,
  resolvePageIndexFromPaginationSnapshot,
  type PaginationSnapshot,
} from "./reader-pagination";
import { createRestoreIntent } from "./reader-navigation";

describe("reader pagination", () => {
  it("resolves cached edge-start restores to the first page", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "start" },
      "restore:chapter-a:start",
    );

    expect(
      resolvePageIndexFromPaginationSnapshot({
        activeChapterId: "chapter-a",
        activeLocator: null,
        consumedRestoreIntentKey: null,
        currentPageIndex: 9,
        keepRestorePinned: true,
        locatorPageIndex: null,
        restorePageIndex: null,
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toEqual({
      nextPageIndex: 0,
      restoreState: "resolved",
    });
  });

  it("resolves cached edge-end restores to the last page", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "end" },
      "restore:chapter-a:end",
    );

    expect(
      resolvePageIndexFromPaginationSnapshot({
        activeChapterId: "chapter-a",
        activeLocator: null,
        consumedRestoreIntentKey: null,
        currentPageIndex: 0,
        keepRestorePinned: true,
        locatorPageIndex: null,
        restorePageIndex: null,
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toEqual({
      nextPageIndex: 21,
      restoreState: "resolved",
    });
  });

  it("resolves cached block restores from the snapshot map", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { blockId: "chapter-a::b2" },
      "restore:chapter-a:block",
    );

    expect(
      resolvePageIndexFromPaginationSnapshot({
        activeChapterId: "chapter-a",
        activeLocator: null,
        consumedRestoreIntentKey: null,
        currentPageIndex: 0,
        keepRestorePinned: false,
        locatorPageIndex: null,
        restorePageIndex: 7,
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toEqual({
      nextPageIndex: 7,
      restoreState: "resolved",
    });
  });

  it("keeps sticky end restores pinned after cached page counts grow", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "end" },
      "restore:chapter-a:end",
    );

    expect(
      resolvePageIndexFromPaginationSnapshot({
        activeChapterId: "chapter-a",
        activeLocator: {
          blockId: "chapter-a::b3",
          chapterId: "chapter-a",
          textOffset: 0,
        },
        consumedRestoreIntentKey: restoreIntent.key,
        currentPageIndex: 21,
        keepRestorePinned: true,
        locatorPageIndex: 21,
        restorePageIndex: null,
        restoreIntent,
        snapshot: {
          ...createSnapshot(),
          pageCount: 24,
        },
      }),
    ).toEqual({
      nextPageIndex: 23,
      restoreState: "idle",
    });
  });

  it("uses the cached locator page once restore intent is already consumed", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "start" },
      "restore:chapter-a:start",
    );

    expect(
      resolvePageIndexFromPaginationSnapshot({
        activeChapterId: "chapter-a",
        activeLocator: {
          blockId: "chapter-a::b2",
          chapterId: "chapter-a",
          textOffset: 0,
        },
        consumedRestoreIntentKey: restoreIntent.key,
        currentPageIndex: 0,
        keepRestorePinned: false,
        locatorPageIndex: 7,
        restorePageIndex: null,
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toEqual({
      nextPageIndex: 7,
      restoreState: "idle",
    });
  });

  it("keeps restore pending when an exact block restore is still unresolved", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      {
        blockId: "chapter-a::missing",
        textOffset: 214,
      },
      "restore:chapter-a:block:pending",
    );

    expect(
      resolvePageIndexFromPaginationSnapshot({
        activeChapterId: "chapter-a",
        activeLocator: null,
        consumedRestoreIntentKey: null,
        currentPageIndex: 4,
        keepRestorePinned: false,
        locatorPageIndex: null,
        restorePageIndex: null,
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toEqual({
      nextPageIndex: 4,
      restoreState: "pending",
    });
  });

  it("changes the layout key when width, height, or font scale changes", () => {
    const baseInput = {
      chapterId: "chapter-a",
      fontScale: 1,
      libraryItemId: "library-item",
      viewportHeight: 720,
      viewportWidth: 480,
    };

    expect(
      createPaginationLayoutKey({
        ...baseInput,
        viewportWidth: 500,
      }),
    ).not.toBe(createPaginationLayoutKey(baseInput));
    expect(
      createPaginationLayoutKey({
        ...baseInput,
        viewportHeight: 760,
      }),
    ).not.toBe(createPaginationLayoutKey(baseInput));
    expect(
      createPaginationLayoutKey({
        ...baseInput,
        fontScale: 1.1,
      }),
    ).not.toBe(createPaginationLayoutKey(baseInput));
  });
});

function createSnapshot(): PaginationSnapshot {
  return {
    blockPageIndexById: {
      "chapter-a::b1": 0,
      "chapter-a::b2": 7,
      "chapter-a::b3": 21,
    },
    layoutKey: createPaginationLayoutKey({
      chapterId: "chapter-a",
      fontScale: 1,
      libraryItemId: "library-item",
      viewportHeight: 720,
      viewportWidth: 480,
    }),
    pageCount: 22,
  };
}

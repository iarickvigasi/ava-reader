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
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toBe(0);
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
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toBe(21);
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
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toBe(7);
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
        restoreIntent,
        snapshot: {
          ...createSnapshot(),
          pageCount: 24,
        },
      }),
    ).toBe(23);
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
        restoreIntent,
        snapshot: createSnapshot(),
      }),
    ).toBe(7);
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

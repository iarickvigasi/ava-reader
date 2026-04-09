import { describe, expect, it } from "vitest";
import type { ReaderStatusPayload } from "./api-types";
import {
  createInitialTraversalState,
  createRestoreIntent,
  readerTraversalReducer,
  resolveNextPageIndex,
  resolveRequestedChapterId,
  resolveVisibleChapterId,
} from "./reader-navigation";

describe("reader navigation", () => {
  it("keeps the committed next chapter visible after a fetched window arrives", () => {
    const initialState = createInitialTraversalState(
      createReadyPayload({
        activeChapterId: "chapter-a",
        chapterIds: ["chapter-a", "chapter-b"],
      }),
    );

    const pendingState = readerTraversalReducer(initialState, {
      chapterId: "chapter-b",
      type: "start-pending",
    });
    const committedState = readerTraversalReducer(pendingState, {
      chapterId: "chapter-b",
      key: "commit:chapter-b",
      target: { edge: "start" },
      type: "commit-chapter",
    });

    const fetchedPayload = createReadyPayload({
      activeChapterId: "chapter-b",
      chapterIds: ["chapter-a", "chapter-b", "chapter-c"],
    });

    expect(resolveVisibleChapterId(fetchedPayload, committedState.visibleChapterId)).toBe(
      "chapter-b",
    );
  });

  it("pins edge-end restores to the real last page after late pagination changes", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "end" },
      "restore:chapter-a:end",
    );

    expect(
      resolveNextPageIndex({
        activeChapterId: "chapter-a",
        consumedRestoreIntentKey: null,
        currentPageIndex: 0,
        keepRestorePinned: true,
        locatorPageIndex: null,
        measuredPageCount: 22,
        restorePageIndex: null,
        restoreIntent,
      }),
    ).toBe(21);

    expect(
      resolveNextPageIndex({
        activeChapterId: "chapter-a",
        consumedRestoreIntentKey: restoreIntent.key,
        currentPageIndex: 21,
        keepRestorePinned: true,
        locatorPageIndex: null,
        measuredPageCount: 24,
        restorePageIndex: null,
        restoreIntent,
      }),
    ).toBe(23);
  });

  it("commits loaded TOC navigation immediately at chapter start", () => {
    const initialState = createInitialTraversalState(
      createReadyPayload({
        activeChapterId: "chapter-a",
        chapterIds: ["chapter-a", "chapter-b", "chapter-c"],
      }),
    );

    const nextState = readerTraversalReducer(initialState, {
      chapterId: "chapter-c",
      key: "commit:chapter-c",
      target: { edge: "start" },
      type: "commit-chapter",
    });

    expect(nextState.pendingChapterId).toBeNull();
    expect(nextState.visibleChapterId).toBe("chapter-c");
    expect(nextState.restoreIntent).toMatchObject({
      chapterId: "chapter-c",
      kind: "edge-start",
    });
  });

  it("keeps the current visible chapter until an unloaded chapter fetch commits", () => {
    const initialState = createInitialTraversalState(
      createReadyPayload({
        activeChapterId: "chapter-a",
        chapterIds: ["chapter-a", "chapter-b"],
      }),
    );

    const pendingState = readerTraversalReducer(initialState, {
      chapterId: "chapter-d",
      type: "start-pending",
    });

    expect(pendingState.visibleChapterId).toBe("chapter-a");
    expect(pendingState.pendingChapterId).toBe("chapter-d");
  });

  it("restores the saved block on normal reader open", () => {
    const initialState = createInitialTraversalState(
      createReadyPayload({
        activeChapterId: "chapter-b",
        chapterIds: ["chapter-a", "chapter-b", "chapter-c"],
      }),
    );

    expect(
      resolveRequestedChapterId({
        pendingChapterId: initialState.pendingChapterId,
        visibleChapterId: initialState.visibleChapterId,
      }),
    ).toBe("chapter-b");

    expect(initialState.restoreIntent).toMatchObject({
      chapterId: "chapter-b",
      kind: "block",
      blockId: "chapter-b::block-1",
      textOffset: 38,
    });
  });
});

function createReadyPayload(input: {
  activeChapterId: string;
  chapterIds: string[];
}): Extract<ReaderStatusPayload, { status: "READY" }> {
  return {
    activeChapterId: input.activeChapterId,
    book: {
      author: "Author",
      libraryItemId: "library-item",
      primaryFormat: "EPUB",
      title: "Book",
    },
    chapters: input.chapterIds.map((chapterId, index) => ({
      blocks: [],
      chapterId,
      href: `#${chapterId}`,
      label: chapterId,
      nextChapterId: input.chapterIds[index + 1] ?? null,
      previousChapterId: input.chapterIds[index - 1] ?? null,
      spineIndex: index,
      title: chapterId,
    })),
    progress: {
      chapterLabel: input.activeChapterId,
      completionPercent: 0,
      lastReadAt: null,
      locator: {
        blockId: `${input.activeChapterId}::block-1`,
        chapterId: input.activeChapterId,
        textOffset: 38,
      },
    },
    status: "READY",
    toc: input.chapterIds.map((chapterId, index) => ({
      anchorId: null,
      blockId: null,
      chapterId,
      children: [],
      href: `#${chapterId}`,
      id: `toc:${index}`,
      label: chapterId,
      spineIndex: index,
    })),
  };
}

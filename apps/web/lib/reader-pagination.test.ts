import { describe, expect, it } from "vitest";
import type { PaginationDecisionInput } from "./reader-pagination";
import {
  createPaginationLayoutKey,
  resolvePaginationDecision,
} from "./reader-pagination";
import { createRestoreIntent } from "./reader-navigation";

describe("reader pagination", () => {
  it("resolves pending edge-start restores to the first page", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "start" },
      "restore:chapter-a:start",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          currentPageIndex: 9,
          restoreIntent,
        }),
      ),
    ).toEqual({
      nextPageIndex: 0,
      shouldConsumeRestoreIntent: true,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("resolves pending edge-end restores to the last page", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "end" },
      "restore:chapter-a:end",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          currentPageIndex: 0,
          restoreIntent,
        }),
      ),
    ).toEqual({
      nextPageIndex: 21,
      shouldConsumeRestoreIntent: true,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("resolves pending block restores from exact page matches", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { blockId: "chapter-a::b2" },
      "restore:chapter-a:block",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          restoreIntent,
          restorePageResolution: {
            pageIndex: 7,
            column: 2,
            status: "exact",
          },
        }),
      ),
    ).toEqual({
      nextPageIndex: 7,
      shouldConsumeRestoreIntent: true,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("resolves pending block restores from block-start fallback matches", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { blockId: "chapter-a::b2" },
      "restore:chapter-a:block:start",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          restoreIntent,
          restorePageResolution: {
            pageIndex: 5,
            column: 2,
            status: "block-start",
          },
        }),
      ),
    ).toEqual({
      nextPageIndex: 5,
      shouldConsumeRestoreIntent: true,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("falls back pending block restores to the first page when block mapping is missing", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      {
        blockId: "chapter-a::missing",
        textOffset: 214,
      },
      "restore:chapter-a:block:missing",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          currentPageIndex: 4,
          restoreIntent,
          restorePageResolution: {
            status: "missing-block",
          },
        }),
      ),
    ).toEqual({
      nextPageIndex: 0,
      shouldConsumeRestoreIntent: true,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("warns and falls back when measurement failed during a pending restore", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "end" },
      "restore:chapter-a:end",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          measurementStatus: "failed",
          restoreIntent,
        }),
      ),
    ).toEqual({
      nextPageIndex: 21,
      shouldConsumeRestoreIntent: true,
      shouldWarnFailedMeasurement: true,
    });
  });

  it("keeps sticky end restores pinned after restore intent is consumed", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "end" },
      "restore:chapter-a:end",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          consumedRestoreIntentKey: restoreIntent.key,
          currentPageIndex: 21,
          keepRestorePinned: true,
          pageCount: 24,
          restoreIntent,
        }),
      ),
    ).toEqual({
      nextPageIndex: 23,
      shouldConsumeRestoreIntent: false,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("uses visible locator resolution once restore intent is already consumed", () => {
    const restoreIntent = createRestoreIntent(
      "chapter-a",
      { edge: "start" },
      "restore:chapter-a:start",
    );

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          consumedRestoreIntentKey: restoreIntent.key,
          restoreIntent,
          visibleLocatorChapterId: "chapter-a",
          visiblePageResolution: {
            pageIndex: 7,
            column: 2,
            status: "exact",
          },
        }),
      ),
    ).toEqual({
      nextPageIndex: 7,
      shouldConsumeRestoreIntent: false,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("ignores visible locator resolution from other chapters", () => {
    expect(
      resolvePaginationDecision(
        createDecisionInput({
          currentPageIndex: 6,
          visibleLocatorChapterId: "chapter-b",
          visiblePageResolution: {
            pageIndex: 7,
            column: 2,
            status: "exact",
          },
        }),
      ),
    ).toEqual({
      nextPageIndex: 6,
      shouldConsumeRestoreIntent: false,
      shouldWarnFailedMeasurement: false,
    });
  });

  it("warns when measurement is failed without a pending restore", () => {
    expect(
      resolvePaginationDecision(
        createDecisionInput({
          measurementStatus: "failed",
        }),
      ),
    ).toEqual({
      nextPageIndex: 4,
      shouldConsumeRestoreIntent: false,
      shouldWarnFailedMeasurement: true,
    });
  });

  it("clamps current and resolved page indexes to measured bounds", () => {
    expect(
      resolvePaginationDecision(
        createDecisionInput({
          currentPageIndex: 42,
          pageCount: 10,
        }),
      ),
    ).toEqual({
      nextPageIndex: 9,
      shouldConsumeRestoreIntent: false,
      shouldWarnFailedMeasurement: false,
    });

    expect(
      resolvePaginationDecision(
        createDecisionInput({
          currentPageIndex: 1,
          pageCount: 10,
          visibleLocatorChapterId: "chapter-a",
          visiblePageResolution: {
            pageIndex: 99,
            column: 2,
            status: "exact",
          },
        }),
      ),
    ).toEqual({
      nextPageIndex: 9,
      shouldConsumeRestoreIntent: false,
      shouldWarnFailedMeasurement: false,
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

function createDecisionInput(
  overrides: Partial<PaginationDecisionInput> = {},
): PaginationDecisionInput {
  return {
    activeChapterId: "chapter-a",
    consumedRestoreIntentKey: null,
    currentPageIndex: 4,
    keepRestorePinned: false,
    measurementStatus: "ready",
    pageCount: 22,
    restoreIntent: null,
    restorePageResolution: null,
    visibleLocatorChapterId: null,
    visiblePageResolution: null,
    ...overrides,
  };
}

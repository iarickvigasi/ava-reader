import { describe, expect, it } from "vitest";
import type { ReaderStatusPayload } from "@/lib/api-types";
import {
  createInitialTraversalState,
  readerTraversalReducer,
  resolveVisibleChapterId,
} from "@/lib/reader-navigation";
import { createRestoreIntentKey } from "./use-reader-chapter-navigation.helpers";

describe("useReaderScreenController smoke", () => {
  it("keeps unloaded-chapter navigation lifecycle stable", () => {
    const initialPayload = createReadyPayload({
      activeChapterId: "chapter-1",
      chapterIds: ["chapter-1", "chapter-2", "chapter-3"],
    });
    const initialTraversal = createInitialTraversalState(initialPayload);

    const pendingTraversal = readerTraversalReducer(initialTraversal, {
      chapterId: "chapter-99",
      type: "start-pending",
    });

    expect(pendingTraversal.pendingChapterId).toBe("chapter-99");
    expect(pendingTraversal.visibleChapterId).toBe("chapter-1");

    const fetchedPayload = createReadyPayload({
      activeChapterId: "chapter-99",
      chapterIds: ["chapter-98", "chapter-99", "chapter-100"],
    });

    const committedTraversal = readerTraversalReducer(pendingTraversal, {
      chapterId: fetchedPayload.activeChapterId,
      key: createRestoreIntentKey({
        chapterId: fetchedPayload.activeChapterId,
        sequence: 1,
        target: { edge: "start" },
      }),
      target: { edge: "start" },
      type: "commit-chapter",
    });

    const settledTraversal = readerTraversalReducer(committedTraversal, {
      chapterId: fetchedPayload.activeChapterId,
      type: "clear-pending",
    });

    expect(settledTraversal.pendingChapterId).toBeNull();
    expect(
      resolveVisibleChapterId(fetchedPayload, settledTraversal.visibleChapterId),
    ).toBe("chapter-99");
  });
});

function createReadyPayload(input: {
  activeChapterId: string;
  chapterIds: string[];
}): Extract<ReaderStatusPayload, { status: "READY" }> {
  return {
    activeChapterId: input.activeChapterId,
    book: {
      author: "Fixture Author",
      libraryItemId: "reader-resume-fixture",
      primaryFormat: "EPUB",
      title: "Reader Resume Fixture",
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
        textOffset: 0,
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

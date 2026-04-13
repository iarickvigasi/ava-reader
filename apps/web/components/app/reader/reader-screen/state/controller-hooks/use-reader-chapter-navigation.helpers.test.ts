import { describe, expect, it } from "vitest";
import {
  createRestoreIntentKey,
  shouldApplyBackgroundResponse,
  shouldApplyBlockingResponse,
  shouldFinalizeNavigationRequest,
} from "./use-reader-chapter-navigation.helpers";

describe("reader chapter navigation helpers", () => {
  it("creates restore-intent keys with chapter, target segment, and sequence", () => {
    expect(
      createRestoreIntentKey({
        chapterId: "chapter-4",
        sequence: 3,
        target: { edge: "end" },
      }),
    ).toBe("chapter-4:end:3");
  });

  it("guards background responses from stale or irrelevant requests", () => {
    expect(
      shouldApplyBackgroundResponse({
        activeReadyChapterId: "chapter-2",
        currentRequestId: 5,
        requestId: 5,
        requestWasAborted: false,
        targetChapterId: "chapter-2",
      }),
    ).toBe(true);

    expect(
      shouldApplyBackgroundResponse({
        activeReadyChapterId: "chapter-3",
        currentRequestId: 5,
        requestId: 5,
        requestWasAborted: false,
        targetChapterId: "chapter-2",
      }),
    ).toBe(false);

    expect(
      shouldApplyBackgroundResponse({
        activeReadyChapterId: "chapter-2",
        currentRequestId: 6,
        requestId: 5,
        requestWasAborted: false,
        targetChapterId: "chapter-2",
      }),
    ).toBe(false);
  });

  it("guards blocking responses and request finalization", () => {
    expect(
      shouldApplyBlockingResponse({
        currentRequestId: 2,
        requestId: 2,
        requestWasAborted: false,
      }),
    ).toBe(true);
    expect(
      shouldApplyBlockingResponse({
        currentRequestId: 3,
        requestId: 2,
        requestWasAborted: false,
      }),
    ).toBe(false);

    const activeController = new AbortController();
    const otherController = new AbortController();

    expect(
      shouldFinalizeNavigationRequest({
        activeAbortController: activeController,
        currentRequestId: 4,
        requestController: activeController,
        requestId: 4,
      }),
    ).toBe(true);
    expect(
      shouldFinalizeNavigationRequest({
        activeAbortController: activeController,
        currentRequestId: 4,
        requestController: otherController,
        requestId: 4,
      }),
    ).toBe(false);
  });
});

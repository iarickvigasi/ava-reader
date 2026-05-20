import { describe, expect, it } from "vitest";
import type { ReaderStatusPayload } from "@/lib/api-types";
import { createReaderResumeFixturePayload } from "@/features/reader/test-fixture";
import {
  READER_STATUS_FAILED,
  READER_STATUS_READY,
} from "./constants";
import {
  clamp,
  createLocatorFromRestoreIntent,
  formatReaderChapterLabel,
  normalizeReaderStatusPayload,
  roundFontScale,
  shouldRefreshChapterWindow,
} from "./utils";

const RESTORE_INTENT_KIND_BLOCK = "block";
const RESTORE_INTENT_KIND_EDGE_START = "edge-start";

describe("reader screen utils", () => {
  it("pads chapter numbers in chapter labels", () => {
    expect(formatReaderChapterLabel("Chapter 3")).toBe("Chapter 03");
    expect(formatReaderChapterLabel("chapter 12")).toBe("Chapter 12");
    expect(formatReaderChapterLabel("Part 1")).toBe("Part 1");
  });

  it("clamps and rounds font scale values", () => {
    expect(roundFontScale(1.234)).toBe(1.23);
    expect(roundFontScale(0.899)).toBe(0.9);
    expect(clamp(4, 1, 3)).toBe(3);
    expect(clamp(-2, 1, 3)).toBe(1);
    expect(clamp(2, 1, 3)).toBe(2);
  });

  it("creates locators only for block restore intents", () => {
    expect(
      createLocatorFromRestoreIntent({
        blockId: "b1",
        chapterId: "c1",
        kind: RESTORE_INTENT_KIND_BLOCK,
        key: "k1",
        textOffset: 7,
      }),
    ).toEqual({
      blockId: "b1",
      chapterId: "c1",
      textOffset: 7,
    });

    expect(
      createLocatorFromRestoreIntent({
        chapterId: "c1",
        kind: RESTORE_INTENT_KIND_EDGE_START,
        key: "k2",
        sticky: true,
      }),
    ).toBeNull();
  });

  it("normalizes malformed READY payloads into FAILED state", () => {
    const malformedReadyPayload = {
      activeChapterId: "chapter-1",
      book: {
        authors: [],
        libraryItemId: "library-1",
        primaryFormat: "EPUB",
        title: "Malformed",
      },
      message: "ignored",
      progress: {
        chapterLabel: "Chapter 1",
        completionPercent: 0,
        lastReadAt: null,
        locator: null,
      },
      status: READER_STATUS_READY,
      toc: null,
    } as unknown as ReaderStatusPayload;

    const normalized = normalizeReaderStatusPayload(malformedReadyPayload);

    expect(normalized.status).toBe(READER_STATUS_FAILED);
    if (normalized.status === READER_STATUS_FAILED) {
      expect(normalized.message).toContain("incomplete");
    }
  });

  it("detects when chapter window should refresh at edges", () => {
    const payload = getReadyFixturePayload();

    expect(shouldRefreshChapterWindow(payload, "chapter-1")).toBe(false);
    expect(shouldRefreshChapterWindow(payload, "chapter-2")).toBe(false);
    expect(shouldRefreshChapterWindow(payload, "chapter-3")).toBe(false);
  });
});

function getReadyFixturePayload() {
  const payload = createReaderResumeFixturePayload();

  if (payload.status !== READER_STATUS_READY) {
    throw new Error("Expected READY fixture payload.");
  }

  return payload;
}

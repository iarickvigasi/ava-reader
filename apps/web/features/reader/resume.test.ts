import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReaderProgressPayload } from "@/lib/api-types";
import {
  createReaderResumeStorageKey,
  createServerResumeSnapshot,
  parseReaderResumeSnapshot,
  readLocalReaderResumeSnapshot,
  selectPreferredReaderResumeSnapshot,
} from "./resume";

describe("reader resume", () => {
  it("creates a storage key scoped to the library item", () => {
    expect(createReaderResumeStorageKey("library-123")).toBe(
      "ava-reader:resume:library-123",
    );
  });

  it("parses a valid stored resume snapshot", () => {
    expect(
      parseReaderResumeSnapshot(
        JSON.stringify({
          locator: {
            blockId: "chapter-2::b3",
            chapterId: "chapter-2",
            textOffset: 214,
          },
          savedAt: "2026-04-09T10:15:00.000Z",
          version: 2,
        }),
      ),
    ).toEqual({
      locator: {
        blockId: "chapter-2::b3",
        chapterId: "chapter-2",
        textOffset: 214,
      },
      savedAt: "2026-04-09T10:15:00.000Z",
      version: 2,
    });
  });

  it("ignores invalid stored resume snapshots", () => {
    expect(parseReaderResumeSnapshot("{")).toBeNull();
    expect(
      parseReaderResumeSnapshot(
        JSON.stringify({
          locator: {
            blockId: "chapter-2::b3",
            chapterId: "chapter-2",
            textOffset: 14,
          },
          savedAt: "2026-04-09T10:15:00.000Z",
        }),
      ),
    ).toBeNull();
    expect(
      parseReaderResumeSnapshot(
        JSON.stringify({
          locator: {
            blockId: "chapter-2::b3",
            chapterId: "chapter-2",
          },
          savedAt: "2026-04-09T10:15:00.000Z",
          version: 2,
        }),
      ),
    ).toBeNull();
  });

  it("creates a server snapshot from persisted reader progress", () => {
    expect(createServerResumeSnapshot(createProgress())).toEqual({
      locator: {
        blockId: "chapter-2::b3",
        chapterId: "chapter-2",
        textOffset: 214,
      },
      savedAt: "2026-04-09T08:00:00.000Z",
      version: 2,
    });
  });

  it("prefers the newer local snapshot over older server progress", () => {
    const selection = selectPreferredReaderResumeSnapshot({
      localSnapshot: {
        locator: {
          blockId: "chapter-4::b8",
          chapterId: "chapter-4",
          textOffset: 460,
        },
        savedAt: "2026-04-09T10:15:00.000Z",
        version: 2,
      },
      serverSnapshot: createServerResumeSnapshot(createProgress()),
    });

    expect(selection).toEqual({
      snapshot: {
        locator: {
          blockId: "chapter-4::b8",
          chapterId: "chapter-4",
          textOffset: 460,
        },
        savedAt: "2026-04-09T10:15:00.000Z",
        version: 2,
      },
      source: "local",
    });
  });

  it("prefers newer server progress over a stale local snapshot", () => {
    const selection = selectPreferredReaderResumeSnapshot({
      localSnapshot: {
        locator: {
          blockId: "chapter-1::b2",
          chapterId: "chapter-1",
          textOffset: 18,
        },
        savedAt: "2026-04-09T06:15:00.000Z",
        version: 2,
      },
      serverSnapshot: createServerResumeSnapshot(createProgress()),
    });

    expect(selection).toEqual({
      snapshot: {
        locator: {
          blockId: "chapter-2::b3",
          chapterId: "chapter-2",
          textOffset: 214,
        },
        savedAt: "2026-04-09T08:00:00.000Z",
        version: 2,
      },
      source: "server",
    });
  });

  it("ignores an older v1 local snapshot and falls back to server progress", () => {
    const localSnapshot = parseReaderResumeSnapshot(
      JSON.stringify({
        locator: {
          blockId: "chapter-9::b2",
          chapterId: "chapter-9",
          textOffset: 999,
        },
        savedAt: "2026-04-09T12:15:00.000Z",
      }),
    );

    expect(localSnapshot).toBeNull();
    expect(
      selectPreferredReaderResumeSnapshot({
        localSnapshot,
        serverSnapshot: createServerResumeSnapshot(createProgress()),
      }),
    ).toEqual({
      snapshot: {
        locator: {
          blockId: "chapter-2::b3",
          chapterId: "chapter-2",
          textOffset: 214,
        },
        savedAt: "2026-04-09T08:00:00.000Z",
        version: 2,
      },
      source: "server",
    });
  });

  it("deletes stale local snapshots that do not match v2", () => {
    const getItem = vi.fn().mockReturnValue(
      JSON.stringify({
        locator: {
          blockId: "chapter-9::b2",
          chapterId: "chapter-9",
          textOffset: 999,
        },
        savedAt: "2026-04-09T12:15:00.000Z",
      }),
    );
    const removeItem = vi.fn();

    vi.stubGlobal("window", {
      localStorage: {
        getItem,
        removeItem,
      },
    });

    expect(readLocalReaderResumeSnapshot("library-123")).toBeNull();
    expect(getItem).toHaveBeenCalledWith("ava-reader:resume:library-123");
    expect(removeItem).toHaveBeenCalledWith("ava-reader:resume:library-123");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createProgress(): ReaderProgressPayload {
  return {
    chapterLabel: "Chapter 2",
    completionPercent: 45,
    lastReadAt: "2026-04-09T08:00:00.000Z",
    locator: {
      blockId: "chapter-2::b3",
      chapterId: "chapter-2",
      textOffset: 214,
    },
  };
}

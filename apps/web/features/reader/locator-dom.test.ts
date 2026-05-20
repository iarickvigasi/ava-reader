import { describe, expect, it } from "vitest";
import {
  findFirstVisibleBlockIndex,
  resolveTextOffsetTarget,
} from "./locator-dom";

describe("reader locator dom helpers", () => {
  it("maps cumulative text offsets across mixed text-node segments", () => {
    expect(
      resolveTextOffsetTarget([{ length: 5 }, { length: 4 }, { length: 3 }], 0),
    ).toEqual({
      clampedTextOffset: 0,
      nodeIndex: 0,
      offsetInNode: 0,
      totalLength: 12,
    });

    expect(
      resolveTextOffsetTarget([{ length: 5 }, { length: 4 }, { length: 3 }], 6),
    ).toEqual({
      clampedTextOffset: 6,
      nodeIndex: 1,
      offsetInNode: 1,
      totalLength: 12,
    });
  });

  it("clamps out-of-range offsets and skips zero-length segments", () => {
    expect(
      resolveTextOffsetTarget(
        [{ length: 0 }, { length: 4 }, { length: 0 }, { length: 3 }],
        99,
      ),
    ).toEqual({
      clampedTextOffset: 6,
      nodeIndex: 3,
      offsetInNode: 2,
      totalLength: 7,
    });

    expect(resolveTextOffsetTarget([], 4)).toBeNull();
  });

  it("finds the first block that actually intersects the current page", () => {
    expect(
      findFirstVisibleBlockIndex(
        [
          {
            end: 470,
            start: 0,
          },
          {
            end: 620,
            start: 300,
          },
          {
            end: 1100,
            start: 980,
          },
        ],
        480,
        960,
      ),
    ).toBe(1);
  });
});

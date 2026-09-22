import { describe, expect, it } from "vitest";

import {
  fillUntranslatedMeasurements,
  resolveBilingualAnchor,
} from "./resolve-position";
import { anchorMeasurements, anchorUnits } from "./position-test-fixture";

const input = {
  units: anchorUnits,
  chapterId: "chapter",
  locator: null,
  restore: null,
};

describe("bilingual restore anchors", () => {
  it("applies a fresh same-chapter TOC target ahead of the previous visible locator", () => {
    expect(
      resolveBilingualAnchor({
        ...input,
        locator: { chapterId: "chapter", blockId: "block", textOffset: 5 },
        restore: {
          chapterId: "chapter",
          key: "toc",
          kind: "block",
          blockId: "block",
          textOffset: 230,
        },
      }),
    ).toEqual({ unitIndex: 2, offset: 230, edge: null });
  });

  it("preserves the visible source when entering the mode with an already consumed restore", () => {
    expect(
      resolveBilingualAnchor({
        ...input,
        preferLocator: true,
        locator: { chapterId: "chapter", blockId: "block", textOffset: 125 },
        restore: {
          chapterId: "chapter",
          key: "old-request",
          kind: "edge-start",
          sticky: true,
        },
      }),
    ).toEqual({ unitIndex: 1, offset: 125, edge: null });
  });

  it("ignores the previous chapter's locator when navigating backwards to a chapter end", () => {
    expect(
      resolveBilingualAnchor({
        ...input,
        preferLocator: true,
        locator: { chapterId: "other", blockId: "block", textOffset: 10 },
        restore: {
          chapterId: "chapter",
          key: "back",
          kind: "edge-end",
          sticky: true,
        },
      }),
    ).toEqual({ unitIndex: 2, offset: 300, edge: "end" });
  });

  it("uses the next sentence at a boundary and the final sentence beyond a block end", () => {
    const locator = { chapterId: "chapter", blockId: "block", textOffset: 100 };
    expect(resolveBilingualAnchor({ ...input, locator })).toEqual({
      unitIndex: 1,
      offset: 100,
      edge: null,
    });
    expect(
      resolveBilingualAnchor({
        ...input,
        locator: { ...locator, textOffset: 999 },
      }),
    ).toEqual({ unitIndex: 2, offset: 299, edge: null });
  });

  it("falls back to the first source unit when the anchor's block no longer exists", () => {
    expect(
      resolveBilingualAnchor({
        ...input,
        locator: { chapterId: "chapter", blockId: "deleted", textOffset: 250 },
      }),
    ).toEqual({ unitIndex: 0, offset: 0, edge: null });
  });

  it("keeps empty chapters and image anchors valid", () => {
    expect(
      resolveBilingualAnchor({
        ...input,
        units: [],
        restore: {
          chapterId: "chapter",
          key: "end",
          kind: "edge-end",
          sticky: true,
        },
      }),
    ).toEqual({ unitIndex: 0, offset: 0, edge: "end" });
    expect(
      resolveBilingualAnchor({
        ...input,
        units: [
          {
            ...anchorUnits[0],
            kind: "image",
            startOffset: 0,
            endOffset: 0,
            text: "",
          },
        ],
        locator: { chapterId: "chapter", blockId: "block", textOffset: 0 },
      }),
    ).toEqual({ unitIndex: 0, offset: 0, edge: null });
  });
});

describe("provisional source pagination", () => {
  it("uses the measured source columns only for sentences still awaiting translation", () => {
    const measured = [
      anchorMeasurements[0],
      {
        ...anchorMeasurements[1],
        sourceHeight: 250,
        sourcePageCount: 3,
        translationHeight: null,
        translationPageCount: undefined,
      },
    ];
    const result = fillUntranslatedMeasurements(measured);
    expect(result[0]).toBe(measured[0]);
    expect(result[1]).toMatchObject({
      translationHeight: 250,
      translationPageCount: 3,
    });
    expect(measured[1].translationHeight).toBeNull();
  });
});

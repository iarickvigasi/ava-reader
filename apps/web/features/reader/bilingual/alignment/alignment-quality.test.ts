import { describe, expect, it } from "vitest";
import { isSentenceAlignment } from "./validate-alignment";

const source = "annehmen.";
const target = "assume.";
const map = {
  version: 3,
  sourceText: source,
  translatedText: target,
  groups: [
    {
      id: "0",
      source: [{ start: 0, end: 8 }],
      translation: [{ start: 0, end: 6 }],
    },
  ],
};

describe("alignment quality in cached maps", () => {
  it("discards v2 maps while accepting the new version", () => {
    expect(isSentenceAlignment({ ...map, version: 2 }, source, target)).toBe(
      false,
    );
    expect(isSentenceAlignment(map, source, target)).toBe(true);
  });
  it("rejects punctuation-only matches on either side", () => {
    for (const group of [
      { ...map.groups[0], translation: [{ start: 6, end: 7 }] },
      { ...map.groups[0], source: [{ start: 8, end: 9 }] },
    ])
      expect(
        isSentenceAlignment({ ...map, groups: [group] }, source, target),
      ).toBe(false);
  });
});

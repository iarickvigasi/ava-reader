import { describe, expect, it } from "vitest";
import { isSentenceAlignment } from "./validate-alignment";

const map = {
  version: 1,
  sourceText: "miss you",
  translatedText: "tu me manques",
  groups: [
    {
      id: "0",
      source: [{ start: 0, end: 8 }],
      translation: [{ start: 0, end: 13 }],
    },
  ],
};
describe("alignment cache validation", () => {
  it("accepts phrases and rejects maps for a different translation", () => {
    expect(isSentenceAlignment(map, "miss you", "tu me manques")).toBe(true);
    expect(isSentenceAlignment(map, "miss you", "vous me manquez")).toBe(false);
    expect(
      isSentenceAlignment({ ...map, version: 2 }, "miss you", "tu me manques"),
    ).toBe(false);
  });
  it("rejects invalid ranges and overlapping groups", () => {
    expect(
      isSentenceAlignment(
        { ...map, groups: [...map.groups, { ...map.groups[0], id: "1" }] },
        map.sourceText,
        map.translatedText,
      ),
    ).toBe(false);
    expect(
      isSentenceAlignment(
        {
          ...map,
          groups: [{ ...map.groups[0], source: [{ start: 0, end: 99 }] }],
        },
        map.sourceText,
        map.translatedText,
      ),
    ).toBe(false);
  });
  it("rejects splitting an emoji into a partial surrogate", () => {
    expect(
      isSentenceAlignment(
        {
          ...map,
          sourceText: "😀",
          groups: [{ ...map.groups[0], source: [{ start: 0, end: 1 }] }],
        },
        "😀",
        map.translatedText,
      ),
    ).toBe(false);
  });
});

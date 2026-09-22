import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { cloneFlowRange } from "./clone-flow-range";
import { createFlowMeasurer } from "./create-flow-measurer";

vi.mock("./clone-flow-range", () => ({ cloneFlowRange: vi.fn() }));

const chapter: BilingualChapter = {
  libraryItemId: "book",
  chapterId: "chapter",
  contentRevision: "revision",
  targetLang: "es",
  translationVersion: 1,
  translations: {},
  units: [
    {
      id: "short",
      blockId: "p",
      kind: "sentence",
      text: "Mr. ",
      startOffset: 0,
      endOffset: 4,
    },
    {
      id: "rest",
      blockId: "p",
      kind: "sentence",
      text: "Holmes left.",
      startOffset: 4,
      endOffset: 16,
    },
  ],
};
const corrected: BilingualChapter = {
  ...chapter,
  units: [
    {
      ...chapter.units[0],
      id: "combined",
      text: "Mr. Holmes left.",
      endOffset: 16,
    },
  ],
};
const template = { querySelectorAll: () => [] };
const root = {
  querySelector: (selector: string) =>
    selector === "[data-flow-probe]"
      ? { replaceChildren: () => undefined }
      : template,
} as unknown as HTMLElement;
const candidate = (height: number) =>
  ({ getBoundingClientRect: () => ({ height }) }) as HTMLElement;

describe("flow measurement cache", () => {
  beforeEach(() => vi.mocked(cloneFlowRange).mockReset());

  it.each([0, 1] as const)(
    "remeasures side %s when sentence boundaries change at the same range",
    (side) => {
      const cache = new Map<string, number>();
      vi.mocked(cloneFlowRange)
        .mockReturnValueOnce(candidate(40))
        .mockReturnValueOnce(candidate(80));
      expect(chapter.units.map((unit) => unit.text).join("")).toBe(
        corrected.units[0].text,
      );
      const before = createFlowMeasurer(root, chapter, 320, 600, cache);
      expect(before.measure(0, 1, side, true)).toBe(40);

      // Full source content and layout are unchanged, but range 0..1 now includes more text.
      const after = createFlowMeasurer(root, corrected, 320, 600, cache);
      expect(after.measure(0, 1, side, true)).toBe(80);
      expect(cloneFlowRange).toHaveBeenCalledTimes(2);
    },
  );

  it("reuses source geometry while measuring an arriving translation", () => {
    const cache = new Map<string, number>();
    vi.mocked(cloneFlowRange)
      .mockReturnValueOnce(candidate(40))
      .mockReturnValueOnce(candidate(60));
    expect(
      createFlowMeasurer(root, chapter, 320, 600, cache).measureRange(0, 1),
    ).toEqual({ sourceHeight: 40, translationHeight: null });

    const incoming = {
      ...chapter,
      units: chapter.units.map((unit) => ({ ...unit })),
      translations: { short: "Señor. " },
    };
    expect(
      createFlowMeasurer(root, incoming, 320, 600, cache).measureRange(0, 1),
    ).toEqual({ sourceHeight: 40, translationHeight: 60 });
    expect(cloneFlowRange).toHaveBeenCalledTimes(2);
  });
});

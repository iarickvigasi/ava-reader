import { describe, expect, it, vi } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { createFlowMeasurer } from "./create-flow-measurer";
import { measurePairs } from "./measure-pairs";
import { paginatePairs } from "../pagination/paginate-pairs";

vi.mock("./create-flow-measurer", () => ({ createFlowMeasurer: vi.fn() }));

const chapter = {
  units: [{ id: "pair", kind: "sentence" }],
  translations: { pair: "Translation with a final word on the next page." },
} as unknown as BilingualChapter;

describe("paired continuation measurement", () => {
  it.each([0, 1] as const)(
    "measures both columns when side %s exceeds the natural pane height",
    (longSide) => {
      const measure = vi.fn(
        (
          _start: number,
          _end: number,
          side: number,
          _fill = false,
          paged = false,
        ) => (paged ? 2 : side === longSide ? 240 : 199),
      );
      vi.mocked(createFlowMeasurer).mockReturnValue({
        measure,
        measureRange: () => ({ sourceHeight: 240, translationHeight: 199 }),
        resolveContinuation: () => 0,
      });
      const { units } = measurePairs({} as HTMLElement, chapter, 338, 200);
      const result = paginatePairs({ units, paneHeight: 200 });
      expect(result.pages.map((page) => page.continuationIndex)).toEqual([
        0, 1,
      ]);
      expect(units[0].sourcePageCount).toBe(2);
      expect(units[0].translationPageCount).toBe(2);
      expect(measure).toHaveBeenCalledWith(0, 1, 0, false, true);
      expect(measure).toHaveBeenCalledWith(0, 1, 1, false, true);
    },
  );
});

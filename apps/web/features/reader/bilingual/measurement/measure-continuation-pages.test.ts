import { describe, expect, it } from "vitest";
import { measureContinuationPages } from "./measure-continuation-pages";
import { paginatePairs } from "../pagination/paginate-pairs";
import { sentence } from "../pagination/test-fixture";

const metrics = {
  columnCount: 1 as const,
  pageBoxLeft: -100000,
  pageWidth: 338,
  pageSpan: 386,
};

function measuredText(
  rects: { right: number; width: number; height: number }[],
) {
  return {
    scrollWidth: 338,
    getBoundingClientRect: () => ({ left: metrics.pageBoxLeft }),
    children: [
      { getBoundingClientRect: () => ({ right: metrics.pageBoxLeft + 338 }) },
    ],
    ownerDocument: {
      createRange: () => ({
        selectNodeContents: () => undefined,
        getClientRects: () =>
          rects.map((rect) => ({
            ...rect,
            right: metrics.pageBoxLeft + rect.right,
          })),
      }),
    },
  } as unknown as HTMLElement;
}

describe("continuation text measurement", () => {
  it("keeps the final translated word on page two when wrappers report one page", () => {
    const translationPageCount = measureContinuationPages(
      measuredText([
        { right: 338, width: 338, height: 40 },
        { right: 470, width: 84, height: 40 },
      ]),
      metrics,
    );
    expect(translationPageCount).toBe(2);
    const result = paginatePairs({
      units: [
        sentence("pair", 240, 240, {
          sourcePageCount: 2,
          translationPageCount,
        }),
      ],
      paneHeight: 200,
    });
    expect(result.pages.map((page) => page.continuationIndex)).toEqual([0, 1]);
    expect(result.pages[1].continuationIndex!).toBeLessThan(
      translationPageCount,
    );
  });

  it("counts translation-only continuations beyond the source", () => {
    const translationPageCount = measureContinuationPages(
      measuredText([{ right: 850, width: 78, height: 40 }]),
      metrics,
    );
    const result = paginatePairs({
      units: [
        sentence("pair", 40, 450, { sourcePageCount: 1, translationPageCount }),
      ],
      paneHeight: 200,
    });
    expect(result.pages.map((page) => page.continuationIndex)).toEqual([
      0, 1, 2,
    ]);
  });

  it("ignores empty fragments without creating extra pages at the right edge", () => {
    expect(
      measureContinuationPages(
        measuredText([
          { right: 338, width: 338, height: 40 },
          { right: 386, width: 0, height: 40 },
        ]),
        metrics,
      ),
    ).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { resolvePageCount, type PageMetrics } from "./geometry";

const metrics: PageMetrics = {
  columnCount: 1,
  pageBoxLeft: 0,
  pageSpan: 320,
  pageWidth: 300,
};

function createRect(right: number) {
  return { right } as DOMRect;
}

describe("resolvePageCount", () => {
  it("uses individual CSS column fragments when WebKit clamps union widths", () => {
    const child = {
      getBoundingClientRect: () => createRect(300),
      getClientRects: () => [
        createRect(300),
        createRect(620),
        createRect(940),
      ],
    };
    const article = {
      children: [child],
      getBoundingClientRect: () => ({ left: 0 }),
      scrollWidth: 300,
    } as unknown as HTMLElement;

    expect(resolvePageCount(article, metrics)).toBe(3);
  });

  it("keeps scrollWidth as a fallback when fragment rects are unavailable", () => {
    const child = {
      getBoundingClientRect: () => createRect(300),
      getClientRects: () => [],
    };
    const article = {
      children: [child],
      getBoundingClientRect: () => ({ left: 0 }),
      scrollWidth: 620,
    } as unknown as HTMLElement;

    expect(resolvePageCount(article, metrics)).toBe(2);
  });
});

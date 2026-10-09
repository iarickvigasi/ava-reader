import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readerPageRect, revealTablePassage } from "./table-viewport";
import { resolvePageIndexFromLocator } from "./measurement/resolve";
import { focusReaderPassage } from "@/components/app/reader/state/focus-reader-passage";
import {
  collectTextNodeSegments,
  createCharacterRange,
  getRangeRect,
} from "./measurement/dom-segments";
vi.mock("./measurement/dom-segments", () => ({
  collectTextNodeSegments: vi.fn(() => [{ length: 8 }]),
  createCharacterRange: vi.fn(() => ({})),
  getRangeRect: vi.fn(() => ({
    left: 1000,
    right: 1010,
    top: 800,
    bottom: 820,
  })),
  findBlockElement: (article: HTMLElement) =>
    article.querySelector("[data-reader-block]"),
}));
function fixture() {
  const viewport = {
    scrollLeft: 0,
    scrollTop: 0,
    clientLeft: 0,
    clientTop: 0,
    clientWidth: 300,
    clientHeight: 300,
    getBoundingClientRect: () => ({
      left: 20,
      right: 320,
      top: 30,
      bottom: 330,
    }),
  };
  const cell = {
    dataset: { chapterId: "c", blockId: "cell" },
    closest: (selector: string) =>
      selector.includes("data-reader-table-scroll") ? viewport : null,
    getBoundingClientRect: () => ({
      left: 980,
      right: 1040,
      top: 790,
      bottom: 830,
    }),
    focus: vi.fn(),
    tabIndex: undefined as number | undefined,
  };
  return { viewport, cell: cell as unknown as HTMLElement };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRangeRect).mockReturnValue({
    left: 1000,
    right: 1010,
    top: 800,
    bottom: 820,
  } as DOMRect);
});
afterEach(() => vi.unstubAllGlobals());
it("resolves distant cells to their table's actual reading page and column", () => {
  const { cell } = fixture();
  expect(readerPageRect(cell).left).toBe(20);
  const article = { querySelector: () => cell } as unknown as HTMLElement;
  expect(
    resolvePageIndexFromLocator({
      article,
      locator: { chapterId: "c", blockId: "cell", textOffset: 3 },
      metrics: {
        columnCount: 1,
        pageBoxLeft: 20,
        pageWidth: 300,
        pageSpan: 348,
      },
    }),
  ).toEqual({ column: 1, pageIndex: 0, status: "exact" });
});
it("preserves the table column in a two-column spread for distant cell targets", () => {
  const { cell, viewport } = fixture();
  viewport.getBoundingClientRect = () => ({
    left: 500,
    right: 926,
    top: 30,
    bottom: 330,
  });
  expect(
    resolvePageIndexFromLocator({
      article: { querySelector: () => cell } as unknown as HTMLElement,
      locator: { chapterId: "c", blockId: "cell", textOffset: 3 },
      metrics: {
        columnCount: 2,
        pageBoxLeft: 0,
        pageWidth: 900,
        pageSpan: 948,
      },
    }),
  ).toEqual({ column: 2, pageIndex: 0, status: "exact" });
});
it("reveals the whole readable cell while keeping the exact locator character", () => {
  const { viewport, cell } = fixture();
  revealTablePassage(cell, 3);
  expect(createCharacterRange).toHaveBeenLastCalledWith(expect.anything(), 3);
  expect(viewport.scrollLeft).toBe(720);
  expect(viewport.scrollTop).toBe(500);
});
it("focuses an initially clipped table cell after its local content is revealed", () => {
  const { viewport, cell } = fixture();
  const frame = { isConnected: true, querySelectorAll: () => [cell] };
  vi.stubGlobal("document", { querySelector: () => frame });
  vi.stubGlobal("window", { innerWidth: 375, innerHeight: 700 });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
  focusReaderPassage({ chapterId: "c", blockId: "cell", textOffset: 3 });
  expect(viewport.scrollLeft).toBe(720);
  expect(viewport.scrollTop).toBe(500);
  expect(cell.focus).toHaveBeenCalledWith({ preventScroll: true });
});

it("does not pan or focus a table on a different hidden reading page", () => {
  const { viewport, cell } = fixture();
  viewport.getBoundingClientRect = () => ({
    left: 700,
    right: 1000,
    top: 30,
    bottom: 330,
  });
  vi.stubGlobal("document", {
    querySelector: () => ({
      isConnected: true,
      querySelectorAll: () => [cell],
    }),
  });
  vi.stubGlobal("window", { innerWidth: 375, innerHeight: 700 });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
  focusReaderPassage({ chapterId: "c", blockId: "cell", textOffset: 3 });
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
  expect(cell.focus).not.toHaveBeenCalled();
});

it("reveals targets inside the client area without covering them with classic scrollbars", () => {
  const { viewport, cell } = fixture();
  Object.assign(viewport, {
    clientLeft: 2,
    clientTop: 2,
    clientWidth: 281,
    clientHeight: 281,
  });
  revealTablePassage(cell, 3);
  expect(viewport.scrollLeft).toBe(737);
  expect(viewport.scrollTop).toBe(517);
});

it("makes every digit of a fitting last-cell value visible, including padding", () => {
  const { viewport, cell } = fixture();
  cell.getBoundingClientRect = () =>
    ({ left: 310, right: 354, top: 40, bottom: 70 }) as DOMRect;
  vi.mocked(getRangeRect).mockReturnValue({
    left: 315,
    right: 325,
    top: 48,
    bottom: 64,
  } as DOMRect);
  revealTablePassage(cell, 0);
  expect(viewport.scrollLeft).toBe(34);
  expect(viewport.scrollTop).toBe(0);
  const rect = cell.getBoundingClientRect();
  expect(rect.left - viewport.scrollLeft).toBeGreaterThanOrEqual(20);
  expect(rect.right - viewport.scrollLeft).toBeLessThanOrEqual(320);
  expect(createCharacterRange).toHaveBeenLastCalledWith(expect.anything(), 0);
});

it("keeps the exact character on oversized axes instead of jumping to the cell start", () => {
  const { viewport, cell } = fixture();
  cell.getBoundingClientRect = () =>
    ({ left: 500, right: 1200, top: 500, bottom: 1200 }) as DOMRect;
  revealTablePassage(cell, 3);
  expect(viewport.scrollLeft).toBe(690);
  expect(viewport.scrollTop).toBe(490);
});

it("reveals readable horizontal context in a tall wrapped cell without losing the target line", () => {
  const { viewport, cell } = fixture();
  cell.getBoundingClientRect = () =>
    ({ left: 280, right: 400, top: 20, bottom: 720 }) as DOMRect;
  vi.mocked(getRangeRect).mockReturnValue({
    left: 290,
    right: 300,
    top: 500,
    bottom: 520,
  } as DOMRect);
  revealTablePassage(cell, 7);
  expect(viewport.scrollLeft).toBe(80);
  expect(viewport.scrollTop).toBe(190);
  expect(createCharacterRange).toHaveBeenLastCalledWith(expect.anything(), 7);
});

it("uses the containing cell for a nested bilingual fragment but its own UTF16 range", () => {
  const { viewport, cell } = fixture();
  const fragment = {
    closest: (selector: string) =>
      selector === "td, th"
        ? cell
        : selector.includes("data-reader-table-scroll")
          ? viewport
          : null,
    getBoundingClientRect: () => ({
      left: 1000,
      right: 1010,
      top: 800,
      bottom: 820,
    }),
  } as unknown as HTMLElement;
  revealTablePassage(fragment, 3);
  expect(collectTextNodeSegments).toHaveBeenLastCalledWith(fragment);
  expect(createCharacterRange).toHaveBeenLastCalledWith(expect.anything(), 3);
  expect(viewport.scrollLeft).toBe(720);
  expect(viewport.scrollTop).toBe(500);
});

it("does not use an outer cell that belongs to another nested scroll region", () => {
  const { viewport, cell } = fixture();
  const outer = {
    closest: () => ({}),
    getBoundingClientRect: () => ({
      left: 800,
      right: 1050,
      top: 700,
      bottom: 850,
    }),
  };
  const fragment = {
    closest: (selector: string) =>
      selector === "td, th"
        ? outer
        : selector.includes("data-reader-table-scroll")
          ? viewport
          : null,
    getBoundingClientRect: () => ({
      left: 1000,
      right: 1010,
      top: 800,
      bottom: 820,
    }),
  } as unknown as HTMLElement;
  revealTablePassage(fragment, 3);
  expect(viewport.scrollLeft).toBe(690);
  expect(viewport.scrollTop).toBe(490);
  expect(cell.dataset.blockId).toBe("cell");
});

it("preserves superseded and hidden/inert passage guards before local table panning", () => {
  const { viewport, cell } = fixture();
  const frame = { isConnected: true, querySelectorAll: () => [cell] };
  vi.stubGlobal("document", { querySelector: () => frame });
  vi.stubGlobal("window", { innerWidth: 375, innerHeight: 700 });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => callback());
  focusReaderPassage(
    { chapterId: "c", blockId: "cell", textOffset: 3 },
    () => false,
  );
  expect(viewport.scrollLeft).toBe(0);
  expect(cell.focus).not.toHaveBeenCalled();
  const closest = vi.spyOn(cell, "closest").mockReturnValue(cell);
  focusReaderPassage({ chapterId: "c", blockId: "cell", textOffset: 3 });
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
  expect(cell.focus).not.toHaveBeenCalled();
  expect(closest).toHaveBeenCalledWith("[inert], [aria-hidden='true']");
});

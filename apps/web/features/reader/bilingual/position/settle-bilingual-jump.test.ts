import { it, expect, vi } from "vitest";
import { settleBilingualJump } from "./settle-bilingual-jump";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { RestoreIntent } from "@/features/reader/navigation";
import {
  collectTextNodeSegments,
  createCharacterRange,
  getRangeRect,
} from "@/features/reader/measurement/dom-segments";
vi.mock("@/features/reader/measurement/dom-segments", () => ({
  collectTextNodeSegments: vi.fn(() => []),
  createCharacterRange: vi.fn(() => ({})),
  getRangeRect: vi.fn(),
}));
const rect = { left: 10, right: 30, top: 10, bottom: 30 };
const chapter = {
  chapterId: "c",
  units: [
    {
      id: "s",
      kind: "sentence",
      blockId: "cell",
      text: "A😀B",
      startOffset: 10,
      endOffset: 14,
    },
  ],
} as BilingualChapter;
const intent = {
  key: "jump",
  kind: "block",
  chapterId: "c",
  blockId: "cell",
  textOffset: 13,
} as RestoreIntent;
it("settles only a visible exact source fragment and focuses without scrolling", () => {
  const element = {
    dataset: { bilingualUnitId: "s" },
    focus: vi.fn(),
    tabIndex: 0,
  };
  const article = {
    querySelectorAll: () => [element],
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
  } as unknown as HTMLElement;
  vi.mocked(getRangeRect).mockReturnValue(rect as DOMRect);
  expect(settleBilingualJump(article, chapter, intent)).toBe(true);
  expect(createCharacterRange).toHaveBeenLastCalledWith(expect.anything(), 3);
  expect(collectTextNodeSegments).toHaveBeenCalledWith(element);
  expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
  vi.mocked(getRangeRect).mockReturnValue({
    ...rect,
    left: -80,
    right: -10,
  } as DOMRect);
  expect(settleBilingualJump(article, chapter, intent)).toBe(false);
  expect(
    settleBilingualJump(article, chapter, { ...intent, chapterId: "other" }),
  ).toBe(false);
  expect(
    settleBilingualJump(article, chapter, {
      ...intent,
      kind: "block",
      blockId: "missing",
      textOffset: 0,
    }),
  ).toBe(false);
});

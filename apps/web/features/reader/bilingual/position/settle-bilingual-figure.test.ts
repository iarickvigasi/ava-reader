import { expect, it, vi } from "vitest";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { RestoreIntent } from "@/features/reader/navigation";
import { settleBilingualJump } from "./settle-bilingual-jump";
const chapter = {
  chapterId: "c",
  units: [
    {
      id: "figure",
      kind: "image",
      blockId: "image",
      text: "",
      startOffset: 0,
      endOffset: 0,
    },
  ],
} as BilingualChapter;
const intent: RestoreIntent = {
  key: "figure",
  kind: "block",
  chapterId: "c",
  blockId: "image",
  textOffset: 0,
};
function geometry() {
  const element = {
    dataset: { bilingualUnitId: "figure" },
    tabIndex: 0,
    focus: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({
      left: 10,
      right: 90,
      top: 10,
      bottom: 90,
    })),
  };
  const article = {
    querySelectorAll: () => [element],
    getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 }),
  } as unknown as HTMLElement;
  return { element, article };
}
it("settles a visible zero-length figure without treating itself as a following text unit", () => {
  const { element, article } = geometry();
  expect(settleBilingualJump(article, chapter, intent)).toBe(true);
  expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
});
it("refuses hidden figures and nonexistent offsets without claiming arrival", () => {
  const { element, article } = geometry();
  element.getBoundingClientRect.mockReturnValue({
    left: 110,
    right: 190,
    top: 10,
    bottom: 90,
  });
  expect(settleBilingualJump(article, chapter, intent)).toBe(false);
  expect(
    settleBilingualJump(article, chapter, {
      ...intent,
      kind: "block",
      blockId: "image",
      textOffset: 1,
    }),
  ).toBe(false);
  expect(element.focus).not.toHaveBeenCalled();
});

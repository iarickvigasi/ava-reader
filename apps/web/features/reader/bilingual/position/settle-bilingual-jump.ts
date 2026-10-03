import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { RestoreIntent } from "@/features/reader/navigation";
import {
  collectTextNodeSegments,
  createCharacterRange,
  getRangeRect,
} from "@/features/reader/measurement/dom-segments";
export function settleBilingualJump(
  article: HTMLElement,
  chapter: BilingualChapter,
  intent: RestoreIntent,
) {
  if (intent.chapterId !== chapter.chapterId) return false;
  if (intent.kind !== "block") return true;
  const unit = chapter.units.find(
    (u) =>
      u.blockId === intent.blockId &&
      u.startOffset <= intent.textOffset &&
      (u.endOffset > intent.textOffset ||
        (u.endOffset === intent.textOffset &&
          !chapter.units.some(
            (next) =>
              next !== u &&
              next.blockId === u.blockId &&
              next.startOffset === intent.textOffset,
          ))),
  );
  if (!unit) return false;
  const element = [
    ...article.querySelectorAll<HTMLElement>("[data-bilingual-unit-id]"),
  ].find((e) => e.dataset.bilingualUnitId === unit.id);
  if (!element) return false;
  const range =
    unit.kind === "image" || !unit.text
      ? null
      : createCharacterRange(
          collectTextNodeSegments(element),
          Math.min(
            intent.textOffset - unit.startOffset,
            Math.max(0, unit.text.length - 1),
          ),
        );
  const rect = range ? getRangeRect(range) : element.getBoundingClientRect();
  const viewport = article.getBoundingClientRect();
  if (
    !rect ||
    rect.right <= viewport.left ||
    rect.left >= viewport.right ||
    rect.bottom <= viewport.top ||
    rect.top >= viewport.bottom
  )
    return false;
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
  return true;
}

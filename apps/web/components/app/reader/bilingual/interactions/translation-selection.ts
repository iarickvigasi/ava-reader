import { selectionSentenceWindow } from "@/features/reader/selection-sentence-context";
import type { BilingualChapter } from "@/lib/api-types/bilingual";
import type { ReaderSelection } from "../../selection/types";
import { offsetIn } from "./alignment-ranges";

function sentenceFor(node: Node): HTMLElement | null {
  return (
    (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(
      "[data-bilingual-unit-id]",
    ) ?? null
  );
}

export function translationSelection(
  selection: ReaderSelection,
  chapter: BilingualChapter,
): ReaderSelection {
  const { range } = selection;
  const firstElement = sentenceFor(range.startContainer);
  const lastElement = sentenceFor(range.endContainer);
  const firstIndex = chapter.units.findIndex(
    (unit) => unit.id === firstElement?.dataset.bilingualUnitId,
  );
  const lastIndex = chapter.units.findIndex(
    (unit) => unit.id === lastElement?.dataset.bilingualUnitId,
  );
  const first = chapter.units[firstIndex];
  const last = chapter.units[lastIndex];
  if (
    !firstElement ||
    !lastElement ||
    !first ||
    !last ||
    lastIndex < firstIndex
  )
    return { ...selection, locator: null };
  const start = offsetIn(firstElement, range.startContainer, range.startOffset);
  const end = offsetIn(lastElement, range.endContainer, range.endOffset);
  const prefix = `Selected text language: ${chapter.targetLang}.\n`;
  const window = selectionSentenceWindow({
    text: chapter.units
      .slice(firstIndex, lastIndex + 1)
      .map((unit) => chapter.translations[unit.id] ?? "")
      .join(" "),
    selectedText: selection.text,
    start,
    end: firstIndex === lastIndex ? end : Number.MAX_SAFE_INTEGER,
    maxChars: 8000,
  });
  return {
    ...selection,
    locator: {
      chapterId: chapter.chapterId,
      startBlockId: first.blockId,
      startOffset: first.startOffset,
      endBlockId: last.blockId,
      endOffset: last.endOffset,
      contextBefore: "",
      contextAfter: "",
      translation: {
        targetLang: chapter.targetLang,
        contentRevision: chapter.contentRevision,
        startSentenceId: first.id,
        endSentenceId: last.id,
        startOffset: start,
        endOffset: end,
      },
    },
    context: prefix + window.context,
    contextOffset:
      window.contextOffset === undefined
        ? undefined
        : prefix.length + window.contextOffset,
  };
}

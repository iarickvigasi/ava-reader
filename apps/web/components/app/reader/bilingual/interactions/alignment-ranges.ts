import type {
  AlignmentSpan,
  BilingualChapter,
} from "@/lib/api-types/bilingual";
import { isSentenceAlignment } from "@/features/reader/bilingual/alignment/validate-alignment";
import { wordRangeAt } from "../../selection/ios/word-range-at";

export type AlignmentHit = { sentenceId: string; groupId: string };

export function textRange(
  element: HTMLElement,
  span: AlignmentSpan,
): Range | null {
  const doc = element.ownerDocument;
  const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  let offset = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.textContent?.length ?? 0;
    if (!started && span.start < offset + length) {
      range.setStart(node, span.start - offset);
      started = true;
    }
    if (started && span.end <= offset + length) {
      range.setEnd(node, span.end - offset);
      return range;
    }
    offset += length;
  }
  return null;
}

export function offsetIn(
  element: HTMLElement,
  node: Node,
  offset: number,
): number {
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.setEnd(node, offset);
  return range.toString().length;
}

export function alignmentAt(
  root: HTMLElement,
  chapter: BilingualChapter,
  x: number,
  y: number,
): AlignmentHit | null {
  const element = root.ownerDocument.elementFromPoint(x, y);
  const sentence = element?.closest<HTMLElement>("[data-bilingual-unit-id]");
  const column = sentence?.closest<HTMLElement>("[data-bilingual-column]");
  if (!sentence || !column || !root.contains(sentence)) return null;
  const side = column.dataset.bilingualColumn;
  if (side !== "source" && side !== "translation") return null;
  const sentenceId = sentence.dataset.bilingualUnitId!;
  const unit = chapter.units.find((unit) => unit.id === sentenceId);
  const map = chapter.alignments?.[sentenceId];
  if (
    !unit ||
    !isSentenceAlignment(map, unit.text, chapter.translations[sentenceId])
  )
    return null;
  // A grapheme hit avoids whitespace and handles scripts without word spaces.
  const range = wordRangeAt(root.ownerDocument, sentence, x, y, "grapheme");
  if (!range) return null;
  const start = offsetIn(sentence, range.startContainer, range.startOffset);
  const end = offsetIn(sentence, range.endContainer, range.endOffset);
  const group = map.groups.find((group) =>
    group[side].some((span) => start < span.end && end > span.start),
  );
  return group ? { sentenceId, groupId: group.id } : null;
}

export function alignmentRects(
  root: HTMLElement,
  chapter: BilingualChapter,
  hit: AlignmentHit,
): DOMRect[] {
  const map = chapter.alignments?.[hit.sentenceId];
  const group = map?.groups.find((group) => group.id === hit.groupId);
  if (!group) return [];
  const rects: DOMRect[] = [];
  for (const column of root.querySelectorAll<HTMLElement>(
    "[data-bilingual-column]",
  )) {
    const side = column.dataset.bilingualColumn;
    if (side !== "source" && side !== "translation") continue;
    const sentence = Array.from(
      column.querySelectorAll<HTMLElement>("[data-bilingual-unit-id]"),
    ).find((node) => node.dataset.bilingualUnitId === hit.sentenceId);
    if (!sentence) continue;
    const clip = column.getBoundingClientRect();
    for (const span of group[side]) {
      const range = textRange(sentence, span);
      for (const rect of Array.from(range?.getClientRects() ?? [])) {
        const left = Math.max(rect.left, clip.left);
        const top = Math.max(rect.top, clip.top);
        const right = Math.min(rect.right, clip.right);
        const bottom = Math.min(rect.bottom, clip.bottom);
        if (right > left && bottom > top)
          rects.push(new DOMRect(left, top, right - left, bottom - top));
      }
    }
  }
  return rects;
}

import type { BilingualChapter } from "@/lib/api-types/bilingual";

export function cloneFlowRange(input: {
  template: HTMLElement;
  nodes: Map<string, HTMLElement>;
  chapter: BilingualChapter;
  start: number;
  end: number;
  fillMissing: boolean;
}): HTMLElement {
  const { template, nodes, chapter, start, end, fillMissing } = input;
  const first = nodes.get(chapter.units[start]?.id);
  const last = nodes.get(chapter.units[end - 1]?.id);
  const candidate = template.cloneNode(false) as HTMLElement;
  if (!first || !last) return candidate;
  const range = template.ownerDocument.createRange();
  range.setStartBefore(first);
  range.setEndAfter(last);
  let content: Node = range.cloneContents();
  let ancestor: Node | null = range.commonAncestorContainer;
  while (ancestor && ancestor !== template) {
    const wrapper = ancestor.cloneNode(false);
    wrapper.appendChild(content);
    content = wrapper;
    ancestor = ancestor.parentNode;
  }
  candidate.appendChild(content);
  normalizeFragment(candidate, chapter, fillMissing);
  return candidate;
}

function normalizeFragment(
  candidate: HTMLElement,
  chapter: BilingualChapter,
  fillMissing: boolean,
) {
  const firstUnit = (element: HTMLElement) => {
    const span = element.querySelector<HTMLElement>(
      "[data-bilingual-unit-index]",
    );
    return chapter.units[Number(span?.dataset.bilingualUnitIndex)];
  };
  for (const block of candidate.querySelectorAll<HTMLElement>(
    "[data-bilingual-flow-block]",
  )) {
    const content = block.querySelector<HTMLElement>(
      "[data-bilingual-flow-content]",
    );
    if (
      content &&
      block.dataset.flowBlockKind === "paragraph" &&
      (firstUnit(block)?.startOffset ?? 0) > 0
    ) {
      content.style.textIndent = "0";
    }
  }
  for (const item of candidate.querySelectorAll<HTMLElement>(
    "[data-bilingual-flow-item]",
  )) {
    if (
      (firstUnit(item)?.startOffset ?? 0) >
      Number(item.dataset.bilingualFlowItemStart)
    ) {
      item.style.listStyleType = "none";
    }
  }
  if (fillMissing)
    for (const span of candidate.querySelectorAll<HTMLElement>(
      "[data-bilingual-missing]",
    )) {
      span.textContent =
        chapter.units[Number(span.dataset.bilingualUnitIndex)]?.text.trim() ??
        "";
    }
}

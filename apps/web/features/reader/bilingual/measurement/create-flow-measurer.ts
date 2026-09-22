import type { BilingualChapter } from "@/lib/api-types/bilingual";
import {
  resolvePageCount,
  type PageMetrics,
} from "@/features/reader/measurement/geometry";
import { resolvePageIndexFromLocator } from "@/features/reader/measurement/resolve";
import {
  BILINGUAL_CONTINUATION_GAP,
  bilingualColumnStyle,
} from "./column-style";
import { cloneFlowRange } from "./clone-flow-range";

export function createFlowMeasurer(
  root: HTMLElement,
  chapter: BilingualChapter,
  width: number,
  height: number,
  cache = new Map<string, number>(),
) {
  const probe = root.querySelector<HTMLElement>("[data-flow-probe]")!;
  const templates = (["source", "translation"] as const).map((side) => {
    const template = root.querySelector<HTMLElement>(
      `[data-natural='${side}']`,
    )!;
    const nodes = new Map(
      Array.from(
        template.querySelectorAll<HTMLElement>("[data-bilingual-unit-id]"),
      ).map((element) => [element.dataset.bilingualUnitId!, element]),
    );
    return { template, nodes };
  });
  const create = (
    start: number,
    end: number,
    side: 0 | 1,
    fillMissing: boolean,
  ) => cloneFlowRange({ ...templates[side], chapter, start, end, fillMissing });
  const measure = (
    start: number,
    end: number,
    side: 0 | 1,
    fillMissing = false,
    paged = false,
  ) => {
    const rangeKey = JSON.stringify(
      chapter.units
        .slice(start, end)
        .map((unit) =>
          side === 1
            ? [unit.id, chapter.translations[unit.id] ?? null]
            : unit.id,
        ),
    );
    const key = `${start}:${end}:${side}:${fillMissing}:${paged}:${rangeKey}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const candidate = create(start, end, side, fillMissing);
    if (paged) applyColumns(candidate, width, height);
    probe.replaceChildren(candidate);
    const result = paged
      ? resolvePageCount(candidate, metrics(candidate, width))
      : Math.ceil(candidate.getBoundingClientRect().height);
    probe.replaceChildren();
    cache.set(key, result);
    return result;
  };
  const measureRange = (start: number, end: number, allowMissing = false) => {
    const missing = chapter.units
      .slice(start, end)
      .some(
        (unit) => unit.kind === "sentence" && !chapter.translations[unit.id],
      );
    return {
      sourceHeight: measure(start, end, 0),
      translationHeight:
        missing && !allowMissing ? null : measure(start, end, 1, allowMissing),
    };
  };
  const resolveContinuation = (unitIndex: number, sourceOffset: number) => {
    const unit = chapter.units[unitIndex];
    if (!unit) return 0;
    const candidate = create(unitIndex, unitIndex + 1, 0, false);
    applyColumns(candidate, width, height);
    probe.replaceChildren(candidate);
    const result = resolvePageIndexFromLocator({
      article: candidate,
      metrics: metrics(candidate, width),
      locator: {
        chapterId: chapter.chapterId,
        blockId: unit.blockId,
        textOffset: Math.max(0, sourceOffset - unit.startOffset),
      },
    });
    probe.replaceChildren();
    return result.status === "missing-block" ? 0 : result.pageIndex;
  };
  return { measure, measureRange, resolveContinuation };
}

function applyColumns(element: HTMLElement, width: number, height: number) {
  const style = bilingualColumnStyle(width, height);
  Object.assign(element.style, {
    ...style,
    width: `${width}px`,
    height: `${height}px`,
    columnWidth: `${width}px`,
    columnGap: `${BILINGUAL_CONTINUATION_GAP}px`,
    left: "0px",
  });
}

function metrics(element: HTMLElement, width: number): PageMetrics {
  return {
    columnCount: 1,
    pageBoxLeft: element.getBoundingClientRect().left,
    pageWidth: width,
    pageSpan: width + BILINGUAL_CONTINUATION_GAP,
  };
}

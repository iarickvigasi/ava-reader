import type { BilingualChapter } from "@/lib/api-types/bilingual";
import { createFlowMeasurer } from "./create-flow-measurer";
import type { MeasuredBilingualUnit } from "../types";

export function measurePairs(
  root: HTMLElement,
  chapter: BilingualChapter,
  width: number,
  height: number,
  cache?: Map<string, number>,
) {
  const flow = createFlowMeasurer(root, chapter, width, height, cache);
  const units: MeasuredBilingualUnit[] = chapter.units.map((unit, index) => {
    const translated =
      unit.kind !== "sentence" || chapter.translations[unit.id] !== undefined;
    const needsColumns = () =>
      flow.measure(index, index + 1, 0) > height ||
      (translated && flow.measure(index, index + 1, 1) > height);
    return {
      id: unit.id,
      kind: unit.kind,
      get sourceHeight() {
        return flow.measure(index, index + 1, 0);
      },
      get translationHeight() {
        return translated ? flow.measure(index, index + 1, 1) : null;
      },
      get sourcePageCount() {
        return needsColumns()
          ? flow.measure(index, index + 1, 0, false, true)
          : 1;
      },
      get translationPageCount() {
        return !translated
          ? undefined
          : needsColumns()
            ? flow.measure(index, index + 1, 1, false, true)
            : 1;
      },
    };
  });
  return {
    units,
    measureRange: flow.measureRange,
    resolveContinuation: flow.resolveContinuation,
  };
}

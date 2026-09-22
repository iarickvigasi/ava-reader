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
      unit.kind === "image" || chapter.translations[unit.id] !== undefined;
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
        return flow.measure(index, index + 1, 0) <= height
          ? 1
          : flow.measure(index, index + 1, 0, false, true);
      },
      get translationPageCount() {
        return !translated
          ? undefined
          : flow.measure(index, index + 1, 1) <= height
            ? 1
            : flow.measure(index, index + 1, 1, false, true);
      },
    };
  });
  return {
    units,
    measureRange: flow.measureRange,
    resolveContinuation: flow.resolveContinuation,
  };
}

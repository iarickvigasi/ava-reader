import type { BilingualUnit } from "@/lib/api-types/bilingual";
import type { BilingualPosition } from "./page-position";
import type { BilingualPage, MeasuredBilingualUnit } from "../types";

export const anchorUnits: BilingualUnit[] = [0, 1, 2].map((index) => ({
  id: `sentence-${index}`,
  blockId: "block",
  startOffset: index * 100,
  endOffset: (index + 1) * 100,
  text: "sentence",
  kind: "sentence",
}));

export const anchorMeasurements: MeasuredBilingualUnit[] = anchorUnits.map(
  (unit) => ({
    id: unit.id,
    kind: "sentence",
    sourceHeight: 20,
    translationHeight: 20,
    sourcePageCount: 1,
    translationPageCount: 1,
  }),
);

export const anchorPosition: BilingualPosition = {
  key: "book:chapter:request",
  restoreKey: "request",
  unitIndex: 1,
  continuation: 0,
  layoutKey: "old-size",
  offset: 125,
  edge: null,
};

export function anchorPage(
  indexes: number[],
  continuationIndex?: number,
): BilingualPage {
  return {
    unitIndexes: indexes,
    startUnitId: anchorUnits[indexes[0]].id,
    usedHeight: 100,
    isComplete: true,
    ...(continuationIndex === undefined ? {} : { continuationIndex }),
  };
}

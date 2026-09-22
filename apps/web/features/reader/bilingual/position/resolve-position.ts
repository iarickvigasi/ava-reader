import type { BilingualUnit } from "@/lib/api-types/bilingual";
import type { ReaderLocator } from "@/lib/api-types";
import type { RestoreIntent } from "../../navigation";
import type { MeasuredBilingualUnit } from "../types";

export function resolveBilingualAnchor(input: {
  units: readonly BilingualUnit[];
  chapterId: string;
  locator: ReaderLocator | null;
  restore: RestoreIntent | null;
  preferLocator?: boolean;
}): { unitIndex: number; offset: number; edge: "start" | "end" | null } {
  const { units, chapterId } = input;
  const locator = input.locator?.chapterId === chapterId ? input.locator : null;
  const restore = input.restore?.chapterId === chapterId ? input.restore : null;
  const useLocator = locator && (input.preferLocator || !restore);
  const edge =
    !useLocator && restore?.kind === "edge-end"
      ? "end"
      : !useLocator && restore?.kind === "edge-start"
        ? "start"
        : null;
  if (edge) {
    const unitIndex = edge === "end" ? Math.max(0, units.length - 1) : 0;
    const unit = units[unitIndex];
    return {
      unitIndex,
      offset: (edge === "end" ? unit?.endOffset : unit?.startOffset) ?? 0,
      edge,
    };
  }
  const target = useLocator
    ? locator
    : restore?.kind === "block"
      ? restore
      : locator;
  const indexes = units.flatMap((unit, index) =>
    unit.blockId === target?.blockId ? [index] : [],
  );
  if (!indexes.length)
    return { unitIndex: 0, offset: units[0]?.startOffset ?? 0, edge: null };
  const offset = Number.isFinite(target?.textOffset)
    ? Math.max(0, target!.textOffset)
    : 0;
  const unitIndex =
    indexes.find((index) => units[index].endOffset > offset) ??
    indexes.at(-1) ??
    0;
  const unit = units[unitIndex];
  const boundedOffset = unit
    ? Math.max(unit.startOffset, Math.min(offset, unit.endOffset - 1))
    : 0;
  return { unitIndex, offset: boundedOffset, edge: null };
}

export function fillUntranslatedMeasurements(units: MeasuredBilingualUnit[]) {
  return units.map((unit) =>
    unit.translationHeight === null
      ? {
          ...unit,
          translationHeight: unit.sourceHeight,
          translationPageCount: unit.sourcePageCount,
        }
      : unit,
  );
}

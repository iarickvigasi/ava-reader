import type { MeasuredBilingualUnit } from "../types";

export const sentence = (
  id: string,
  sourceHeight: number,
  translationHeight: number | null = sourceHeight,
  extra: Partial<MeasuredBilingualUnit> = {},
): MeasuredBilingualUnit => ({
  id,
  kind: "sentence",
  sourceHeight,
  translationHeight,
  ...extra,
});

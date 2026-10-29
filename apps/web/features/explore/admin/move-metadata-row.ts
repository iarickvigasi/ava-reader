import type { MetadataRow } from "./types";

export function moveMetadataRow(
  rows: MetadataRow[],
  index: number,
  offset: number,
) {
  const next = [...rows];
  const target = index + offset;
  if (target < 0 || target >= rows.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

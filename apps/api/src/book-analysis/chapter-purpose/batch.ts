// Most books fit in a single request. The cap only exists so a 400-chapter
// collected-works edition degrades into a few sequential calls instead of one
// oversized prompt. Every batch still carries the full chapter title list
// (titles cost ~5 tokens each), so cross-chapter context survives the split.
export const MAX_CHAPTERS_PER_REQUEST = 60;

export function batchChapters<T>(
  items: T[],
  size: number = MAX_CHAPTERS_PER_REQUEST,
): T[][] {
  if (size < 1) {
    throw new Error('Batch size must be at least 1.');
  }

  const batches: T[][] = [];

  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }

  return batches;
}

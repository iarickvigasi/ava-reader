export type HeaderWidths = { title: number; author: number; chapter: number };
export const HEADER_FIELDS = ["title", "author", "chapter"] as const;
const SHARES: HeaderWidths = { title: 0.4, author: 0.3, chapter: 0.3 };
const RECLAIM_ORDER = ["author", "title", "chapter"] as const;

export function allocateHeaderWidths(
  natural: HeaderWidths,
  available: number,
): HeaderWidths {
  const budget = Math.max(0, available);
  const widths: HeaderWidths = {
    title: Math.min(natural.title, budget * SHARES.title),
    author: Math.min(natural.author, budget * SHARES.author),
    chapter: Math.min(natural.chapter, budget * SHARES.chapter),
  };
  let spare = Math.max(
    0,
    budget - widths.title - widths.author - widths.chapter,
  );
  for (const field of RECLAIM_ORDER) {
    const extra = Math.min(spare, natural[field] - widths[field]);
    widths[field] += extra;
    spare -= extra;
  }
  return widths;
}

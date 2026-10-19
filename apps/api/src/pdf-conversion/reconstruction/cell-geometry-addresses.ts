import type { RecognitionResponse } from './generated/RecognitionResponse';

// A requested cell can have a reversed box or a positive box outside its table.
// The installed worker still rederives eligibility and probes every other rule.
export function cellGeometryAddresses(
  original: RecognitionResponse,
): number[][] {
  const addresses: number[][] = [];
  original.segments.forEach((segment, i) => {
    if (segment.kind !== 'table') return;
    const a = segment.box;
    segment.cells?.forEach((row, r) =>
      row.forEach((cell, c) => {
        const b = cell.box;
        if (
          b &&
          (b.x0 >= b.x1 ||
            b.y0 >= b.y1 ||
            b.x0 < a.x0 ||
            b.x1 > a.x1 ||
            b.y0 < a.y0 ||
            b.y1 > a.y1)
        )
          addresses.push([i, r, c]);
      }),
    );
  });
  return addresses;
}

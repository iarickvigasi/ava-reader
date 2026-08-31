export type SelectionEndpoint = { x: number; y: number };

export type SelectionEndpoints = {
  start: SelectionEndpoint;
  end: SelectionEndpoint;
};

// Where the two drag handles sit, in viewport coordinates: the leading edge of
// the first line rect and the trailing edge of the last. Shared so the overlay
// draws them exactly where the gesture hit-tests them.
export function readRangeEndpoints(range: Range): SelectionEndpoints | null {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0,
  );

  if (rects.length === 0) {
    return null;
  }

  const first = rects[0];
  const last = rects[rects.length - 1];

  return {
    start: { x: first.left, y: first.top },
    end: { x: last.right, y: last.bottom },
  };
}

export function isWithin(
  point: SelectionEndpoint,
  x: number,
  y: number,
  radius: number,
): boolean {
  return Math.abs(point.x - x) <= radius && Math.abs(point.y - y) <= radius;
}

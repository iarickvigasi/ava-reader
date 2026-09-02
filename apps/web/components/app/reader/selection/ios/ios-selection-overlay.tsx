"use client";

// Draws the selection iOS refuses to draw (spec 2.6 Behaviour 8): one tinted
// rect per line box plus the two drag handles, in viewport coordinates, below
// the panels and deaf to pointers.
export function IosSelectionOverlay({ rects }: { rects: DOMRect[] }) {
  if (rects.length === 0) {
    return null;
  }

  const first = rects[0];
  const last = rects[rects.length - 1];

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {rects.map((rect) => (
        <div
          key={`${rect.left},${rect.top},${rect.width}`}
          className="absolute bg-brand-fill/20"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      ))}
      <SelectionHandle x={first.left} y={first.top} />
      <SelectionHandle x={last.right} y={last.bottom} />
    </div>
  );
}

function SelectionHandle({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute size-3 rounded-full bg-brand-fill"
      style={{ left: x - 6, top: y - 6 }}
    />
  );
}

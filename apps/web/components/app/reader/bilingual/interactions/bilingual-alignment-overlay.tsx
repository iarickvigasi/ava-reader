export function BilingualAlignmentOverlay({ rects }: { rects: DOMRect[] }) {
  if (!rects.length) return null;
  return (
    <div
      aria-hidden="true"
      data-bilingual-alignment-overlay
      className="pointer-events-none fixed inset-0 z-30"
    >
      {rects.map((rect, index) => (
        <div
          key={index}
          className="absolute rounded-sm"
          style={{
            backgroundColor: "var(--alignment-highlight)",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        />
      ))}
    </div>
  );
}

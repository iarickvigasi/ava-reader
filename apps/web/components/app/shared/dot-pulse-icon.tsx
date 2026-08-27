// Three-dot pulse shown while an action is in flight — the save-offline card
// icon and the PendingLabel animated ellipsis. Keyframe `ava-dot-pulse` is
// declared in globals.css. The wrapper hugs the dots; callers own alignment
// (the card centers it in its icon row, PendingLabel baseline-aligns it).
export function DotPulseIcon() {
  return (
    <span aria-hidden className="inline-flex items-center gap-1">
      {[0, 0.18, 0.36].map((delay) => (
        <span
          key={delay}
          className="inline-block size-1 rounded-full bg-current"
          style={{
            animation: `ava-dot-pulse 1.4s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

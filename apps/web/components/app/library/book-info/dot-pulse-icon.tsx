// Three-dot pulse used as the icon while a save is in flight. Keyframe
// `ava-dot-pulse` is declared in globals.css.
export function DotPulseIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex items-center gap-1"
      style={{ height: "1.125rem" }}
    >
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

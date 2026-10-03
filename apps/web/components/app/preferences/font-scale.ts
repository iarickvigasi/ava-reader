export const DEFAULT_FONT_SCALE = 1;
export const MIN_FONT_SCALE = 0.85;
export const MAX_FONT_SCALE = 1.35;

const FONT_SCALE_STEPS = [0.85, 0.9, 1, 1.1, 1.2, 1.3, 1.35];

// Keep the default reachable after either endpoint. Older saved values remain
// valid and move to the next step in the requested direction on first use.
export function stepFontScale(current: number, direction: -1 | 1): number {
  const value = Number.isFinite(current) ? current : DEFAULT_FONT_SCALE;
  const steps =
    direction === 1 ? FONT_SCALE_STEPS : [...FONT_SCALE_STEPS].reverse();
  return (
    steps.find((step) => direction * (step - value) > 0.000001) ??
    (direction === 1 ? MAX_FONT_SCALE : MIN_FONT_SCALE)
  );
}

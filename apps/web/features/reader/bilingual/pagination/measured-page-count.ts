/** Continuous text height cannot predict line breaks, widows, or orphan rules. */
export function measuredPageCount(
  count: number | undefined,
  height: number,
  paneHeight: number,
) {
  if (count === undefined) return height <= paneHeight ? 1 : null;
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(
      "Measured column page counts must be positive integers",
    );
  }
  // A stale one-column measurement must never permit overflowing text.
  return height > paneHeight && count === 1 ? null : count;
}

export function assertNonnegativeFinite(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and nonnegative`);
  }
}

// Stride-3 scheduling: given an ordered chapter list and the set of ids we
// already have on disk, returns the minimal set of "fetch anchors" that
// will cover everything that isn't covered yet, assuming the API returns a
// 3-chapter window (±1) per call.
//
// Strategy: pick indices i = 1, 4, 7, …, but
//   - skip any anchor whose chapter id (and ±1 neighbours) are already on
//     disk — no point fetching to cover what we already have,
//   - if the very first chapter isn't covered, use index 1 (or 0 for a
//     single-chapter book) to anchor it.
//
// The result feeds into a concurrent worker pool with zero overlap because
// each anchor's window covers a disjoint 3-chapter slice.
export function pickStrideTargets(
  ordered: string[],
  covered: Set<string>,
): string[] {
  if (ordered.length === 0) {
    return [];
  }
  // Simulate the coverage each anchor will gain so we don't add a final
  // anchor for a chapter that a stride window will already cover.
  const willCover = new Set(covered);
  const out: string[] = [];
  // Walk anchors at stride 3 starting from index 1 (so window i-1, i, i+1
  // catches the first chapter). Single-chapter book uses index 0.
  let i = ordered.length === 1 ? 0 : 1;
  for (; i < ordered.length; i += 3) {
    const slice = [ordered[i - 1], ordered[i], ordered[i + 1]].filter(
      (id): id is string => !!id,
    );
    if (slice.every((id) => willCover.has(id))) {
      continue;
    }
    out.push(ordered[i]!);
    for (const id of slice) {
      willCover.add(id);
    }
  }
  // Last-chapter guard. After simulating every stride anchor, if the spine
  // length doesn't line up the last id may still be uncovered.
  const last = ordered[ordered.length - 1]!;
  if (!willCover.has(last) && !out.includes(last)) {
    out.push(last);
  }
  return out;
}

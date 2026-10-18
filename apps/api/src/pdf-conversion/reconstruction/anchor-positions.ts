type Locator = {
  exact_text: string;
  before?: string | null;
  after?: string | null;
};

// UTF-16 positions are used only to compare exact occurrences in the same immutable text.
// Two matches suffice to disprove uniqueness, preserving the original bounded search.
export function anchorPositions(text: string, anchor: Locator): number[] {
  const positions: number[] = [];
  for (
    let at = text.indexOf(anchor.exact_text);
    at >= 0;
    at = text.indexOf(anchor.exact_text, at + 1)
  ) {
    const end = at + anchor.exact_text.length;
    if (
      text.slice(0, at).endsWith(anchor.before ?? '') &&
      text.slice(end).startsWith(anchor.after ?? '')
    ) {
      positions.push(at);
      if (positions.length > 1) break;
    }
  }
  return positions;
}

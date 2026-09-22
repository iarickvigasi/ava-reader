/** Convert a DOM selection point in a rendered fragment to its book offset. */
export function sourceOffsetWithin(
  block: HTMLElement,
  node: Node,
  nodeOffset: number,
): number | null {
  if (!block.contains(node) && node !== block) return null;
  const probe = block.ownerDocument.createRange();
  try {
    probe.setStart(block, 0);
    probe.setEnd(node, nodeOffset);
  } catch {
    return null;
  }
  const rawStart = Number(block.dataset.readerStartOffset ?? 0);
  const fragmentStart =
    Number.isSafeInteger(rawStart) && rawStart >= 0 ? rawStart : 0;
  return fragmentStart + probe.toString().length;
}

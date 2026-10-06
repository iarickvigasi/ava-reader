import type { ReaderTocNode } from '../../reader/reader-types';
import { isHrefLabel } from '../../reader/epub/toc/is-href-label';

export function findFilenameLabels(
  nodes: ReaderTocNode[],
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const node of nodes) {
    if (node.chapterId && isHrefLabel(node.label, node.href))
      labels.set(node.chapterId, node.label);
    for (const [id, label] of findFilenameLabels(node.children))
      labels.set(id, label);
  }
  return labels;
}

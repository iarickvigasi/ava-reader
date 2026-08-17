import { decodeXmlEntities } from '../shared/xml-entities';
import type { ReaderTocNode } from './reader-types';

// Shared by the reader package and the reading-progress index — both store a
// TOC tree and both must reach the UI with entities decoded.
export function normalizeTocDisplayText(
  nodes: ReaderTocNode[],
): ReaderTocNode[] {
  return nodes.map((node) => ({
    ...node,
    children: normalizeTocDisplayText(node.children),
    label: decodeXmlEntities(node.label),
  }));
}

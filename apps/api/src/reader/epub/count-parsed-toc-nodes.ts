import type { ParsedTocNode } from './toc';

export function countParsedTocNodes(nodes: ParsedTocNode[]): number {
  return nodes.reduce(
    (count, node) => count + 1 + countParsedTocNodes(node.children),
    0,
  );
}

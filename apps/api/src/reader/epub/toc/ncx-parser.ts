import { firstAsArray } from '../xml-utils';
import type { NcxNode, ParsedTocNode } from './types';
import { createTocNodeId } from './utils';

export function readNcxEntries(
  nodes: NcxNode[],
  path: number[] = [],
): ParsedTocNode[] {
  return nodes.flatMap((node, index) => {
    const href = node.content?.['@_src'] ?? null;
    const label =
      typeof node.navLabel?.text === 'string' ? node.navLabel.text.trim() : '';
    const children = readNcxEntries(firstAsArray(node.navPoint), [
      ...path,
      index,
    ]);

    if (!label && !href && children.length === 0) {
      return [];
    }

    return [
      {
        children,
        href,
        id: createTocNodeId([...path, index]),
        label: label || href || 'Untitled section',
      },
    ];
  });
}

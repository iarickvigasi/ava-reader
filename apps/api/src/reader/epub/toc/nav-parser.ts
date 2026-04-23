import {
  OrderedNode,
  getNodeTagName,
  getNodeChildren,
  getNodeAttributes,
} from '../xml-utils';
import { flattenInlineContent, normalizeInlineText } from '../node-utils';
import type { ParsedTocNode } from './types';
import { createTocNodeId } from './utils';

export function findTocNavNode(nodes: OrderedNode[]): OrderedNode | null {
  for (const node of nodes) {
    const tagName = getNodeTagName(node);

    if (!tagName) {
      continue;
    }

    const attrs = getNodeAttributes(node);
    const typeValue = Object.entries(attrs).find(([key]) =>
      key.endsWith('type'),
    )?.[1];

    if (
      tagName === 'nav' &&
      typeof typeValue === 'string' &&
      typeValue.includes('toc')
    ) {
      return node;
    }

    const childMatch = findTocNavNode(getNodeChildren(node));
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

export function readNavEntries(
  nodes: OrderedNode[],
  path: number[] = [],
): ParsedTocNode[] {
  const listItems = nodes.filter((node) => getNodeTagName(node) === 'li');

  if (listItems.length > 0) {
    return listItems.flatMap((node, index) => {
      const entry = readNavListItem(node, [...path, index]);
      return entry ? [entry] : [];
    });
  }

  const nestedLists = nodes.filter((node) => {
    const tagName = getNodeTagName(node);
    return tagName === 'ol' || tagName === 'ul';
  });

  if (nestedLists.length > 0) {
    return nestedLists.flatMap((node) =>
      readNavEntries(getNodeChildren(node), path),
    );
  }

  return [];
}

function readNavListItem(
  node: OrderedNode,
  path: number[],
): ParsedTocNode | null {
  const children = getNodeChildren(node);
  const linkNode = children.find((child) => getNodeTagName(child) === 'a');
  const href = linkNode
    ? (getNodeAttributes(linkNode)['@_href'] ?? null)
    : null;
  const label = inlineNodesToText(flattenInlineContent(node));
  const nestedEntries = children.flatMap((child) => {
    const tagName = getNodeTagName(child);
    if (tagName !== 'ol' && tagName !== 'ul') {
      return [];
    }
    return readNavEntries(getNodeChildren(child), path);
  });

  if (!label && !href && nestedEntries.length === 0) {
    return null;
  }

  return {
    children: nestedEntries,
    href,
    id: createTocNodeId(path),
    label: label || href || 'Untitled section',
  };
}

function inlineNodesToText(nodes: OrderedNode[]): string {
  return nodes
    .map((node) => {
      const tagName = getNodeTagName(node);
      if (tagName === '#text') {
        const rawText = node['#text'];
        return typeof rawText === 'string' || typeof rawText === 'number'
          ? normalizeInlineText(String(rawText))
          : '';
      }
      return inlineNodesToText(getNodeChildren(node));
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

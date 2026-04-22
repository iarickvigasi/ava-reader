import { XMLParser } from 'fast-xml-parser';

export type OrderedNode = Record<string, unknown>;

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  trimValues: true,
});

export const orderedXmlParser = new XMLParser({
  ignoreAttributes: false,
  preserveOrder: true,
  removeNSPrefix: false,
  trimValues: false,
});

export function getNodeTagName(node: OrderedNode): string | undefined {
  return Object.keys(node)
    .find((key) => key !== ':@')
    ?.split(':')
    .at(-1);
}

export function getNodeChildren(node: OrderedNode): OrderedNode[] {
  const tagName = Object.keys(node).find((key) => key !== ':@');
  if (!tagName) {
    return [];
  }

  const value = node[tagName];
  return Array.isArray(value) ? (value as OrderedNode[]) : [];
}

export function getNodeAttributes(node: OrderedNode): Record<string, string> {
  return (node[':@'] ?? {}) as Record<string, string>;
}

export function findFirstNodeByTag(
  nodes: OrderedNode[],
  tagName: string,
): OrderedNode | null {
  for (const node of nodes) {
    const currentTag = getNodeTagName(node);
    if (currentTag === tagName) {
      return node;
    }

    const nestedMatch = findFirstNodeByTag(getNodeChildren(node), tagName);
    if (nestedMatch) {
      return nestedMatch;
    }
  }

  return null;
}

export function firstAsArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

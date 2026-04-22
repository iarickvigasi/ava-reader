import { OrderedNode, getNodeTagName, getNodeChildren } from './xml-utils';

export function flattenInlineContent(node: OrderedNode): OrderedNode[] {
  const children = getNodeChildren(node);
  if (children.length === 0) {
    return [];
  }

  return children.flatMap((child) => {
    const tagName = getNodeTagName(child);
    if (tagName === 'ol' || tagName === 'ul') {
      return [];
    }
    return [child];
  });
}

export function normalizeInlineText(value: string) {
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, ' ');
}

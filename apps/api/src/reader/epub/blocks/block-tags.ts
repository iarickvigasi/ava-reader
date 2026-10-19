import { getNodeTagName, type OrderedNode } from '../xml-utils';
const containers = new Set([
  'article',
  'body',
  'div',
  'main',
  'section',
  'figure',
  'blockquote',
]);
const inlines = new Set([
  'a',
  'b',
  'br',
  'cite',
  'code',
  'em',
  'i',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
]);
export const isBlockContainerTag = (tag: string) => containers.has(tag);
export const isInlineContainerTag = (tag: string) => inlines.has(tag);
export function hasDirectBlockChildren(children: OrderedNode[]): boolean {
  return children.some((child) => {
    const tag = getNodeTagName(child);
    return (
      !!tag &&
      (containers.has(tag) ||
        /^(?:img|aside|blockquote|ol|p|ul|h[1-6]|table|pre|figcaption|hr)$/.test(
          tag,
        ))
    );
  });
}

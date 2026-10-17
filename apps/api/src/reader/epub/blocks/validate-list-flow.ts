import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import { unsupportedSourceStructure } from './unsupported-source-structure';
import type { BlockContext } from './block-context';

// Items store a single inline flow followed by nested groups. Paragraph/structured
// own flow and content after nested groups need a richer sequence representation.
export function validateListFlow(
  node: OrderedNode,
  context: BlockContext,
): void {
  let nested = false;
  for (const child of getNodeChildren(node)) {
    const tag = getNodeTagName(child);
    if (tag === 'ol' || tag === 'ul') {
      nested = true;
      continue;
    }
    if (containsStructure(child) || (nested && hasOwnContent(child)))
      unsupportedSourceStructure('EPUB_UNSUPPORTED_LIST_FLOW', node, context);
  }
}
const STRUCTURES = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'blockquote',
  'aside',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'ol',
  'ul',
  'li',
  'dl',
  'dt',
  'dd',
  'pre',
  'hr',
]);
function containsStructure(node: OrderedNode): boolean {
  const tag = getNodeTagName(node) ?? '';
  return (
    STRUCTURES.has(tag) ||
    /^h[1-6]$/.test(tag) ||
    getNodeChildren(node).some(containsStructure)
  );
}
function hasOwnContent(node: OrderedNode): boolean {
  const tag = getNodeTagName(node);
  if (tag === '#text')
    return typeof node['#text'] === 'string'
      ? node['#text'].trim().length > 0
      : typeof node['#text'] === 'number';
  if (tag === 'img') return true;
  const attrs = getNodeAttributes(node);
  return (
    !!(attrs['@_id'] || attrs['@_name']) ||
    getNodeChildren(node).some(hasOwnContent)
  );
}

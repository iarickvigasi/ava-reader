import {
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import { unsupportedSourceStructure } from './unsupported-source-structure';
import type { BlockContext } from './block-context';

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
// Simple cells retain inline content. Nested blocks require a different model.
export function validateTableCell(
  node: OrderedNode,
  context: BlockContext,
): void {
  const visit = (children: OrderedNode[]): boolean =>
    children.some((child) => {
      const tag = getNodeTagName(child) ?? '';
      return (
        STRUCTURES.has(tag) ||
        /^h[1-6]$/.test(tag) ||
        visit(getNodeChildren(child))
      );
    });
  if (visit(getNodeChildren(node)))
    unsupportedSourceStructure('EPUB_UNSUPPORTED_TABLE_CELL', node, context);
}

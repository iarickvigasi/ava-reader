import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';

// Only explicit semantic actions are excluded from authored note prose.
export function splitNoteBacklinks(nodes: OrderedNode[]): {
  body: OrderedNode[];
  backlinks: OrderedNode[];
} {
  const backlinks: OrderedNode[] = [];
  const visit = (children: OrderedNode[]): OrderedNode[] =>
    children.flatMap((node) => {
      const attrs = getNodeAttributes(node);
      if (
        getNodeTagName(node) === 'a' &&
        ((attrs['@_role'] ?? '').split(/\s+/).includes('doc-backlink') ||
          (attrs['@_epub:type'] ?? '').split(/\s+/).includes('backlink'))
      ) {
        backlinks.push(node);
        return [];
      }
      const key = Object.keys(node).find((key) => key !== ':@');
      if (!key || !Array.isArray(node[key])) return [node];
      const children = visit(getNodeChildren(node));
      const result = { ...node, [key]: children };
      return getNodeTagName(node) === 'p' ? [result, { br: [] }] : [result];
    });
  return { body: visit(nodes), backlinks };
}

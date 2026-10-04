import {
  getNodeAttributes,
  getNodeChildren,
  type OrderedNode,
} from '../xml-utils';

export function backlinkSourceAliases(node: OrderedNode): string[] {
  const attrs = getNodeAttributes(node);
  return [
    ...[attrs['@_id'], attrs['@_name']].filter((id): id is string =>
      Boolean(id),
    ),
    ...getNodeChildren(node).flatMap(backlinkSourceAliases),
  ];
}

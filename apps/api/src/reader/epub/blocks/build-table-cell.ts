import type { ReaderTableCell } from '../../reader-types';
import {
  getNodeAttributes,
  getNodeChildren,
  getNodeTagName,
  type OrderedNode,
} from '../xml-utils';
import { nodeStyleAncestor } from '../css/lookup-stylesheet-hints';
import { normalizeInlineNodes, buildInlineText } from './inline';
import {
  applyBlockStyleHints,
  resolveBlockStyleHints,
} from './block-style-hints';
import { validateTableCell } from './validate-table-cell';
import { positiveSpan } from './table-layout';
import type { BlockContext } from './block-context';

export async function buildTableCell(
  node: OrderedNode,
  rowNode: OrderedNode,
  context: BlockContext,
  row: number,
  column: number,
): Promise<ReaderTableCell> {
  validateTableCell(node, context);
  const attrs = getNodeAttributes(node);
  const tagName = getNodeTagName(node)!;
  const hints = resolveBlockStyleHints({
    ...context,
    tagName,
    attrs,
    inherited: context.hints,
  });
  const inlines = await normalizeInlineNodes(
    getNodeChildren(node),
    context.resolveAsset,
    {
      literal: hints.literal,
      language: hints.language,
      stylesheetHints: context.stylesheetHints,
      presentation: hints.presentation,
      ancestors: [
        ...(context.ancestors ?? []),
        nodeStyleAncestor('tr', getNodeAttributes(rowNode)),
        nodeStyleAncestor(tagName, attrs),
      ],
    },
  );
  return applyBlockStyleHints(
    {
      id: context.createBlockId(),
      anchorId: attrs['@_id'] ?? null,
      row,
      column,
      rowSpan: positiveSpan(attrs['@_rowspan']),
      columnSpan: positiveSpan(attrs['@_colspan']),
      headerAxis:
        tagName === 'th'
          ? attrs['@_scope'] === 'row' || attrs['@_scope'] === 'rowgroup'
            ? 'row'
            : 'column'
          : null,
      headerIds: (attrs['@_headers'] ?? '').split(/\s+/).filter(Boolean),
      inlines,
      text: buildInlineText(inlines, { literal: hints.literal }),
    },
    hints,
  );
}

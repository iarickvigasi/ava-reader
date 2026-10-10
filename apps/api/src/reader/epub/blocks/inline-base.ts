import type { ReaderInline } from '../../reader-types';
import type { EpubAsset } from '../archive';
import {
  getNodeTagName,
  getNodeChildren,
  getNodeAttributes,
  type OrderedNode,
} from '../xml-utils';
import { inlinePresentation } from './inline-presentation';
import { deriveInlineState } from './inline-state';
import { resolveInlineImage } from './inline-image';
import { compactInlines } from './compact-inlines';
import { mappedInlineText } from './mapped-inline-text';
import type { InlineState } from './inline-options';

export async function parseInlineNodes(
  nodes: OrderedNode[],
  resolveAsset: (path: string) => Promise<EpubAsset | null>,
  initial: InlineState = {},
): Promise<ReaderInline[]> {
  const inlines: ReaderInline[] = [];
  let anchors: string[] = [];
  const add = (inline: ReaderInline) => {
    inlines.push({
      ...inline,
      ...(anchors.length ? { anchorIds: [...new Set(anchors)] } : {}),
    });
    anchors = [];
  };
  const visit = async (items: OrderedNode[], state: InlineState) => {
    for (const node of items) {
      const tag = getNodeTagName(node);
      if (!tag) continue;
      const attrs = getNodeAttributes(node);
      anchors.push(...[attrs['@_id'], attrs['@_name']].filter(Boolean));
      if (tag === '#text' || tag === 'br') {
        const raw = tag === 'br' ? '\n' : scalarText(node['#text']);
        if (!raw) continue;
        const mapped = mappedInlineText(
          raw,
          initial.literal || tag === 'br' ? [] : [[/\s+/g, ' ']],
        );
        add({
          kind: 'text',
          text: mapped.text,
          bold: state.bold,
          fontWeight: state.fontWeight,
          href: state.href,
          italic: state.italic,
          script: state.script,
          ...(state.language ? { language: state.language } : {}),
          ...(state.presentation ? { presentation: state.presentation } : {}),
          ...(raw === mapped.text
            ? {}
            : {
                sourceNormalization: {
                  sourceText: raw,
                  boundaryUtf16: mapped.boundaryUtf16,
                },
              }),
        });
      } else {
        const next = deriveInlineState(node, state);
        if (tag === 'img') {
          const image = await resolveInlineImage(
            node,
            next.href,
            resolveAsset,
            {
              stylesheetHints: state.stylesheetHints,
              ancestors: state.ancestors,
            },
          );
          if (image) add(image);
        } else await visit(getNodeChildren(node), next);
      }
    }
  };
  await visit(nodes, {
    ...initial,
    presentation: inlinePresentation(initial.presentation),
  });
  if (anchors.length) add({ kind: 'text', text: '' });
  return compactInlines(inlines);
}

function scalarText(value: unknown): string {
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value);
  throw new Error('The EPUB text node has an invalid value.');
}

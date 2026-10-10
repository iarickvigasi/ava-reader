import type { OrderedNode } from '../xml-utils';
import type { Style } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import { getNodeAttributes, getNodeTagName } from '../xml-utils';
import { nodeStyleAncestor } from '../css/lookup-stylesheet-hints';
import { inlinePresentation } from './inline-presentation';
import { resolveBlockStyleHints } from './block-style-hints';
import type { InlineState } from './inline-options';

export function deriveInlineState(
  node: OrderedNode,
  state: InlineState,
): InlineState {
  const tagName = getNodeTagName(node)!;
  const attrs = getNodeAttributes(node);
  const own = resolveBlockStyleHints({
    tagName,
    attrs,
    stylesheetHints: state.stylesheetHints,
    ancestors: state.ancestors,
  });
  const strong = ['b', 'strong'].includes(tagName);
  const semantic: Partial<Style> = {
    ...(strong ? { bold: true } : {}),
    ...(['em', 'i'].includes(tagName) ? { italic: true } : {}),
    ...(tagName === 'sup' ? { vertical_align: 'super' } : {}),
    ...(tagName === 'sub' ? { vertical_align: 'sub' } : {}),
  };
  const presentation: Style = {
    id: 'epub-inline-presentation',
    ...state.presentation,
    ...semantic,
    ...inlinePresentation(own.presentation),
  };
  if (own.fontSizeScale != null || state.presentation?.relative_size != null)
    presentation.relative_size =
      (state.presentation?.relative_size ?? 1) * (own.fontSizeScale ?? 1);
  const weight = own.fontWeight ?? (strong ? 700 : state.fontWeight);
  if (own.fontWeight != null) presentation.bold = own.fontWeight >= 600;
  const vertical = presentation.vertical_align;
  return {
    ...state,
    language: attrs['@_xml:lang'] ?? attrs['@_lang'] ?? state.language,
    bold: weight != null ? weight >= 600 : (presentation.bold ?? state.bold),
    fontWeight: weight,
    href: tagName === 'a' ? (attrs['@_href'] ?? state.href) : state.href,
    italic: presentation.italic ?? state.italic,
    script:
      vertical === 'super' || vertical === 'sub'
        ? vertical
        : vertical === 'baseline'
          ? undefined
          : state.script,
    presentation:
      Object.keys(presentation).length > 1 ? presentation : undefined,
    ancestors: [...(state.ancestors ?? []), nodeStyleAncestor(tagName, attrs)],
  };
}

import type {
  StylesheetClassHints,
  StylesheetHintMap,
  StyleAncestor,
} from '../css/build-stylesheet-hints';
import {
  createEmptyStylesheetHintMap,
  mergeStylesheetClassHints,
} from '../css/build-stylesheet-hints';
import { lookupStylesheetHints } from '../css/lookup-stylesheet-hints';
import { extractDeclaredHints } from '../css/extract-declared-hints';
import { parseStylesheet } from '../css/parse-stylesheet';

export type BlockStyleHints = StylesheetClassHints & { language?: string };
export function resolveBlockStyleHints(input: {
  tagName: string;
  attrs: Record<string, string>;
  inherited?: BlockStyleHints;
  stylesheetHints?: StylesheetHintMap;
  ancestors?: StyleAncestor[];
}): BlockStyleHints {
  const { tagName, attrs, inherited } = input;
  const map = input.stylesheetHints ?? createEmptyStylesheetHintMap();
  const stylesheet = lookupStylesheetHints(
    tagName,
    attrs,
    map,
    input.ancestors,
  );
  const declarations = parseStylesheet(
    `.bounded {${attrs['@_style'] ?? ''}}`,
  )[0]?.declarations;
  const inline = declarations ? extractDeclaredHints(declarations) : undefined;
  const own = mergeStylesheetClassHints(stylesheet, inline ?? undefined);
  return {
    ...mergeStylesheetClassHints(inherited, own),
    language: attrs['@_xml:lang'] ?? attrs['@_lang'] ?? inherited?.language,
  };
}
export function applyBlockStyleHints<T>(block: T, hints?: BlockStyleHints): T {
  if (!hints) return block;
  const styles = Object.fromEntries(
    Object.entries(hints).filter(
      ([key, value]) =>
        value !== undefined && key !== 'language' && key !== 'literal',
    ),
  );
  return {
    ...block,
    ...styles,
    ...(hints.literal == null ? {} : { preserveWhitespace: hints.literal }),
  };
}

import { mergeStylesheetClassHints } from './build-stylesheet-hints';
import { matchesDescendantChain } from './contextual-style-hints';
import type {
  StyleAncestor,
  StylesheetClassHints,
  StylesheetHintMap,
} from './style-hint-types';

export function nodeStyleAncestor(
  tagName: string,
  attrs: Record<string, string>,
): StyleAncestor {
  return {
    tagName,
    classNames: (attrs['@_class'] ?? '').split(/\s+/).filter(Boolean),
  };
}
export function lookupStylesheetHints(
  tagName: string,
  attrs: Record<string, string>,
  map: StylesheetHintMap,
  ancestors: StyleAncestor[] = [],
): StylesheetClassHints | undefined {
  const node = nodeStyleAncestor(tagName, attrs);
  if (map.orderedHints) {
    const matches = map.orderedHints
      .filter((rule) =>
        matchesDescendantChain(rule.selectors, [...ancestors, node]),
      )
      .sort(
        (a, b) =>
          a.specificity[0] - b.specificity[0] ||
          a.specificity[1] - b.specificity[1] ||
          a.order - b.order,
      );
    return matches.reduce<StylesheetClassHints | undefined>(
      (result, rule) => mergeStylesheetClassHints(result, rule.hints),
      undefined,
    );
  }
  // Hand-authored/legacy hint maps retain their old lookup contract.
  let result = map.tagHints.get(tagName);
  for (const className of node.classNames)
    result = mergeStylesheetClassHints(result, map.classHints.get(className));
  return result;
}

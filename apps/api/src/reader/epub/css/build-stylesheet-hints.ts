import { parseStylesheet } from './parse-stylesheet';
import { orderedStyleHints } from './contextual-style-hints';
import { extractDeclaredHints } from './extract-declared-hints';
import type {
  StylesheetClassHints,
  StylesheetHintMap,
} from './style-hint-types';
export type {
  StylesheetClassHints,
  StylesheetHintMap,
  StyleAncestor,
} from './style-hint-types';

export function createEmptyStylesheetHintMap(): StylesheetHintMap {
  return { classHints: new Map(), tagHints: new Map() };
}
export function buildStylesheetHintMap(
  cssTexts: readonly string[],
): StylesheetHintMap {
  const map = createEmptyStylesheetHintMap();
  for (const css of cssTexts) {
    for (const rule of parseStylesheet(css)) {
      const declared = extractDeclaredHints(rule.declarations);
      if (!declared) continue;
      for (const selector of rule.selectors) {
        const target =
          selector.kind === 'class' ? map.classHints : map.tagHints;
        const key =
          selector.kind === 'class' ? selector.className : selector.tagName;
        target.set(key, mergeStylesheetClassHints(target.get(key), declared)!);
      }
    }
  }
  map.orderedHints = orderedStyleHints(cssTexts);
  return map;
}
export function mergeStylesheetClassHints(
  base?: StylesheetClassHints,
  overlay?: StylesheetClassHints,
): StylesheetClassHints | undefined {
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    align: overlay.align ?? base.align,
    fontSizeScale: overlay.fontSizeScale ?? base.fontSizeScale,
    fontWeight: overlay.fontWeight ?? base.fontWeight,
    textIndent: overlay.textIndent ?? base.textIndent,
    literal: overlay.literal ?? base.literal,
    presentation:
      base.presentation || overlay.presentation
        ? {
            ...base.presentation,
            ...overlay.presentation,
            id: 'epub-presentation',
          }
        : undefined,
  };
}

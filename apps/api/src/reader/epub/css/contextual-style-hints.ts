import { parseStylesheet } from './parse-stylesheet';
import { extractDeclaredHints } from './extract-declared-hints';
import type { StyleAncestor, StylesheetHintMap } from './style-hint-types';

// Specificity and source order follow CSS for supported simple/descendant selectors.
// Attribute, pseudo, sibling and child selectors remain outside this profile.
export function orderedStyleHints(
  cssTexts: readonly string[],
): NonNullable<StylesheetHintMap['orderedHints']> {
  const result: NonNullable<StylesheetHintMap['orderedHints']> = [];
  for (const css of cssTexts) {
    const rules = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/([^{}@]+)\{([^{}]*)\}/g);
    for (const rule of rules) {
      const declarations = parseStylesheet(`.bounded {${rule[2]}}`)[0]
        ?.declarations;
      const hints = declarations && extractDeclaredHints(declarations);
      if (!hints) continue;
      for (const selector of rule[1].split(',')) {
        const selectors = selector.trim().split(/\s+/);
        if (
          selectors.length < 1 ||
          !selectors.every((part) =>
            /^(?:[a-z][\w-]*|\.[a-zA-Z][\w-]*|[a-z][\w-]*\.[a-zA-Z][\w-]*)$/.test(
              part,
            ),
          )
        )
          continue;
        result.push({
          selectors,
          hints,
          specificity: [
            selectors.filter((selector) => selector.includes('.')).length,
            selectors.filter((selector) => !selector.startsWith('.')).length,
          ],
          order: result.length,
        });
      }
    }
  }
  return result;
}
export function matchesStyleSelector(
  selector: string,
  node: StyleAncestor,
): boolean {
  const [tagName, className] = selector.split('.');
  return (
    (!tagName || tagName === node.tagName) &&
    (!className || node.classNames.includes(className))
  );
}
export function matchesDescendantChain(
  selectors: string[],
  chain: StyleAncestor[],
): boolean {
  if (!matchesStyleSelector(selectors.at(-1)!, chain.at(-1)!)) return false;
  let index = chain.length - 2;
  for (const selector of selectors.slice(0, -1).reverse()) {
    while (index >= 0 && !matchesStyleSelector(selector, chain[index])) index--;
    if (index < 0) return false;
    index--;
  }
  return true;
}

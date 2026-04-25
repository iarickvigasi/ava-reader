/**
 * A *very* small CSS rule extractor for EPUB stylesheets.
 *
 * We deliberately don't implement a real CSS parser — we only need
 * three properties (text-align, font-size, text-indent), and EPUB
 * rules controlling those are almost always plain class or tag
 * selectors like `.indent { … }` or `p { … }`. Anything more complex
 * (descendant combinators, attribute selectors, pseudo-classes) is
 * dropped so it can't accidentally apply to the wrong block.
 *
 * What we keep:
 *   - simple class selectors:        `.foo`
 *   - simple tag selectors:          `p`
 *   - tag.class selectors:           `p.foo`           (treated as class `foo`)
 *   - comma-separated lists thereof: `.foo, p.bar`     (each handled)
 *
 * What we drop:
 *   - everything containing whitespace, `>`, `+`, `~`, `[`, `]`, `:`,
 *     or multiple class chains (e.g. `.foo.bar`, `.foo .bar`, `a:hover`)
 *   - @-rules — we walk past `@media (…)` wrappers and pick up the
 *     inner rules unconditionally (close enough for EPUB use)
 *   - declarations that don't parse cleanly into key/value
 */

export type SimpleSelector =
  | { kind: 'tag'; tagName: string }
  | { kind: 'class'; className: string };

export type CssRule = {
  selectors: SimpleSelector[];
  declarations: Record<string, string>;
};

const RULE_PATTERN = /([^{}@]+)\{([^{}]*)\}/g;
const TAG_NAME_PATTERN = /^[a-z][a-z0-9]*$/;
const CLASS_NAME_PATTERN = /^[a-zA-Z][\w-]*$/;
const REJECT_SELECTOR_CHARS = /[\s>+~[\]:*()=,]/;

export function parseStylesheet(css: string): CssRule[] {
  const stripped = stripComments(css);
  const rules: CssRule[] = [];

  RULE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = RULE_PATTERN.exec(stripped)) !== null) {
    const selectorText = match[1].trim();
    const declarationText = match[2].trim();

    if (!selectorText || !declarationText) {
      continue;
    }

    const selectors = parseSelectorList(selectorText);
    if (selectors.length === 0) {
      continue;
    }

    const declarations = parseDeclarations(declarationText);
    if (Object.keys(declarations).length === 0) {
      continue;
    }

    rules.push({ selectors, declarations });
  }

  return rules;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseSelectorList(selectorText: string): SimpleSelector[] {
  const out: SimpleSelector[] = [];

  for (const piece of selectorText.split(',')) {
    const selector = parseSimpleSelector(piece.trim());
    if (selector) {
      out.push(selector);
    }
  }

  return out;
}

function parseSimpleSelector(selector: string): SimpleSelector | null {
  if (!selector || REJECT_SELECTOR_CHARS.test(selector)) {
    return null;
  }

  if (selector.startsWith('.')) {
    const className = selector.slice(1);
    return CLASS_NAME_PATTERN.test(className)
      ? { kind: 'class', className }
      : null;
  }

  const dotIndex = selector.indexOf('.');
  if (dotIndex < 0) {
    const tagName = selector.toLowerCase();
    return TAG_NAME_PATTERN.test(tagName) ? { kind: 'tag', tagName } : null;
  }

  // tag.class — we only use the class half. The miss rate (e.g. a
  // `div.indent` rule getting picked up for `<p class="indent">`) is
  // benign because we only extract three style properties.
  const className = selector.slice(dotIndex + 1);
  return CLASS_NAME_PATTERN.test(className)
    ? { kind: 'class', className }
    : null;
}

function parseDeclarations(declarationText: string): Record<string, string> {
  const declarations: Record<string, string> = {};

  for (const part of declarationText.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) {
      continue;
    }

    const key = part.slice(0, colon).trim().toLowerCase();
    const value = part
      .slice(colon + 1)
      .replace(/!important/gi, '')
      .trim();

    if (!key || !value) {
      continue;
    }

    declarations[key] = value;
  }

  return declarations;
}

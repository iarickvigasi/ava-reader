/**
 * Convert a CSS text-indent declaration into an em-relative scalar.
 *
 *   `1em`, `1.5rem`, `100%`            → 1, 1.5, 1
 *   `0`, `0em`, `0%`                   → 0    (publisher's "no indent")
 *   `2ch`                              → 1    (1 ch ≈ ½ em → 2 ch ≈ 1 em)
 *   `30px` and other absolute units    → null (no reliable base)
 *   missing / inherited / unparseable  → null
 *
 * Output units are em — they multiply the running font size, so the
 * indent stays proportional to the user's font scale on the frontend.
 */

const TEXT_INDENT_DECLARATION_PATTERN = /(?:^|;)\s*text-indent\s*:\s*([^;]+)/i;

const VALUE_PATTERN = /^(-?[\d.]+)\s*(em|rem|%|ch)?$/i;

const INDENT_MIN = 0;
const INDENT_MAX = 4;

export function resolveTextIndentFromStyle(
  style: string | undefined | null,
): number | null {
  if (!style) {
    return null;
  }

  const match = TEXT_INDENT_DECLARATION_PATTERN.exec(style);
  if (!match) {
    return null;
  }

  return resolveTextIndentValue(match[1].trim().toLowerCase());
}

export function resolveTextIndentValue(value: string): number | null {
  // Bare 0 is fine and very common (`text-indent: 0`).
  if (value === '0') {
    return 0;
  }

  const match = VALUE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const unit = (match[2] ?? '').toLowerCase();

  let em: number;
  switch (unit) {
    case 'em':
    case 'rem':
      em = numeric;
      break;
    case '%':
      // `text-indent: 100%` is "indent by the full container width" in
      // CSS — but in practice EPUB stylesheets use it interchangeably
      // with `1em`-style values. Treat % as em-equivalent.
      em = numeric / 100;
      break;
    case 'ch':
      // 1ch ≈ width of "0", typically ~0.5em. Close enough.
      em = numeric * 0.5;
      break;
    default:
      // Unitless non-zero, px, pt, etc. — drop.
      return null;
  }

  if (em < INDENT_MIN) {
    return null;
  }

  const clamped = Math.min(INDENT_MAX, em);
  return Math.round(clamped * 1000) / 1000;
}

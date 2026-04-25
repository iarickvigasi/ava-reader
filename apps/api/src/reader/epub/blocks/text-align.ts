/**
 * Resolve the text alignment of a block from its source attributes.
 *
 * Two sources are checked, in order:
 *   1. inline `style="text-align: …"` (modern EPUB)
 *   2. legacy `align="…"` HTML attribute (older EPUBs still emit this)
 *
 * CSS logical values (`start`/`end`) are mapped to physical values
 * assuming LTR, which matches every locale we currently render.
 */

export type ReaderTextAlign = 'left' | 'center' | 'right' | 'justify';

const TEXT_ALIGN_DECLARATION_PATTERN = /(?:^|;)\s*text-align\s*:\s*([^;]+)/i;

const PHYSICAL_ALIGNMENTS = new Set<ReaderTextAlign>([
  'left',
  'center',
  'right',
  'justify',
]);

export function resolveTextAlignFromStyle(
  style: string | undefined | null,
): ReaderTextAlign | null {
  if (!style) {
    return null;
  }

  const match = TEXT_ALIGN_DECLARATION_PATTERN.exec(style);
  if (!match) {
    return null;
  }

  return normalizeAlignmentToken(match[1]);
}

export function resolveTextAlignFromAttrs(
  attrs: Record<string, string>,
): ReaderTextAlign | null {
  const fromStyle = resolveTextAlignFromStyle(attrs['@_style']);
  if (fromStyle) {
    return fromStyle;
  }

  return normalizeAlignmentToken(attrs['@_align']);
}

function normalizeAlignmentToken(
  raw: string | undefined | null,
): ReaderTextAlign | null {
  if (!raw) {
    return null;
  }

  const value = raw.trim().toLowerCase();

  if (value === 'start') {
    return 'left';
  }

  if (value === 'end') {
    return 'right';
  }

  return PHYSICAL_ALIGNMENTS.has(value as ReaderTextAlign)
    ? (value as ReaderTextAlign)
    : null;
}

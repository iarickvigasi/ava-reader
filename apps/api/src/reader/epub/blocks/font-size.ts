/**
 * Convert a CSS font-size declaration into a relative scale that the
 * reader frontend can multiply against its base size (1.0 = unchanged).
 *
 * We deliberately handle only *relative* sizes — em/rem/%, plus the CSS
 * absolute and relative keywords (xx-small … xx-large, smaller/larger).
 * Pixel/point values are dropped because we have no reliable base font
 * size to compare them against without parsing the chapter's CSS.
 *
 * Output is clamped to [0.5, 2] and rounded to two decimals so the
 * frontend doesn't end up with extreme or jittery sizes.
 */

const KEYWORD_SCALES: Record<string, number> = {
  // Absolute keywords, normalized to the typical browser ladder.
  'xx-small': 0.6,
  'x-small': 0.75,
  small: 0.875,
  medium: 1,
  large: 1.125,
  'x-large': 1.25,
  'xx-large': 1.5,
  // Relative keywords (treated as a one-step shift from the parent).
  smaller: 0.85,
  larger: 1.2,
};

const RELATIVE_UNIT_PATTERN = /^(-?[\d.]+)\s*(em|rem|%)$/i;
const FONT_SIZE_DECLARATION_PATTERN = /(?:^|;)\s*font-size\s*:\s*([^;]+)/i;

const SCALE_MIN = 0.5;
const SCALE_MAX = 2;
const SCALE_DEFAULT = 1;

export function resolveFontSizeScaleFromStyle(
  style: string | undefined | null,
): number | null {
  if (!style) {
    return null;
  }

  const match = FONT_SIZE_DECLARATION_PATTERN.exec(style);
  if (!match) {
    return null;
  }

  return resolveFontSizeScale(match[1].trim().toLowerCase());
}

export function resolveFontSizeScale(value: string): number | null {
  const keywordScale = KEYWORD_SCALES[value];
  if (keywordScale !== undefined) {
    return clampScale(keywordScale);
  }

  const relativeMatch = RELATIVE_UNIT_PATTERN.exec(value);
  if (!relativeMatch) {
    return null;
  }

  const numeric = Number(relativeMatch[1]);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const unit = relativeMatch[2].toLowerCase();
  const scale = unit === '%' ? numeric / 100 : numeric;

  return clampScale(scale);
}

function clampScale(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, value));
  // Round to 3 decimals — enough precision to preserve canonical CSS
  // ladder values like 0.875 and 1.125 exactly, while keeping the
  // serialized payload terse.
  const rounded = Math.round(clamped * 1000) / 1000;

  // 1.0 is the implicit default — no point storing it.
  return rounded === SCALE_DEFAULT ? null : rounded;
}

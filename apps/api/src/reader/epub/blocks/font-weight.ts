/**
 * Convert a CSS font-weight value into a numeric weight (100..900).
 *
 *   `400`, `700`                       → 400, 700
 *   `normal`                           → 400
 *   `bold`                             → 700
 *   `bolder` / `lighter`               → 700 / 300
 *                                        (we have no parent context, so we
 *                                         fall back to the standard ladder
 *                                         shifts from `normal`)
 *   `inherit`, unparseable, missing    → null
 *
 * Output is rounded to the nearest valid CSS weight bucket (the
 * standard 100-step ladder). The "default" value 400 normalizes to
 * null so we don't store a noisy field on every inline.
 */

const FONT_WEIGHT_DECLARATION_PATTERN = /(?:^|;)\s*font-weight\s*:\s*([^;]+)/i;

const KEYWORD_WEIGHTS: Record<string, number> = {
  normal: 400,
  bold: 700,
  // CSS spec: bolder/lighter shift one bucket from the parent's
  // computed weight. With no parent context we use the conventional
  // shift from 400.
  bolder: 700,
  lighter: 300,
};

const MIN_WEIGHT = 100;
const MAX_WEIGHT = 900;
const WEIGHT_STEP = 100;
const DEFAULT_WEIGHT = 400;

export function resolveFontWeightFromStyle(
  style: string | undefined | null,
): number | null {
  if (!style) {
    return null;
  }

  const match = FONT_WEIGHT_DECLARATION_PATTERN.exec(style);
  if (!match) {
    return null;
  }

  return resolveFontWeightValue(match[1].trim().toLowerCase());
}

export function resolveFontWeightValue(value: string): number | null {
  const keyword = KEYWORD_WEIGHTS[value];
  if (keyword !== undefined) {
    return normalize(keyword);
  }

  if (!/^\d+$/.test(value)) {
    return null;
  }

  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return normalize(numeric);
}

function normalize(value: number): number | null {
  const clamped = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, value));
  // Round to the nearest 100 — every modern font we use exposes
  // weights in 100 steps, and storing 437 would be misleading.
  const bucketed = Math.round(clamped / WEIGHT_STEP) * WEIGHT_STEP;
  return bucketed === DEFAULT_WEIGHT ? null : bucketed;
}

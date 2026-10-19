import type { Style } from '../../../pdf-conversion/contracts/generated/ava-book-2';

// The finite canonical tokens AVA emits; arbitrary publisher CSS is not inferred.
export function declaredPresentation(values: Record<string, string>): Style {
  const style: Style = { id: 'epub-presentation' };
  const family = values['font-family']?.trim().toLowerCase();
  if (family === 'serif' || family === 'sans-serif' || family === 'monospace')
    style.family = family;
  const align = values['text-align']?.toLowerCase();
  if (['start', 'left', 'right', 'center', 'justify'].includes(align))
    style.align = align as Style['align'];
  const italic = values['font-style']?.toLowerCase();
  if (['normal', 'italic', 'oblique'].includes(italic))
    style.italic = italic !== 'normal';
  const caps = values['font-variant']?.toLowerCase();
  if (caps === 'normal' || caps === 'small-caps')
    style.small_caps = caps === 'small-caps';
  const vertical = values['vertical-align']?.toLowerCase();
  if (['baseline', 'super', 'sub'].includes(vertical))
    style.vertical_align = vertical as Style['vertical_align'];
  for (const [property, key, min, max] of NUMERIC_TOKENS) {
    const source = values[property]?.trim().toLowerCase();
    if (
      !source ||
      (!NUMBER_EM.test(source) && !/^[-+]?0(?:\.0+)?$/.test(source))
    )
      continue;
    const value = Number.parseFloat(source);
    if (value >= min && value <= max) style[key] = value;
  }
  const height = values['line-height']?.trim();
  if (height && /^\d*\.?\d+$/.test(height)) {
    const value = Number(height);
    if (value >= 0.5 && value <= 3) style.line_height = value;
  }
  for (const [property, key] of COLOR_TOKENS) {
    const value = values[property]?.trim().toLowerCase();
    if (value && /^#[\da-f]{6}$/.test(value)) style[key] = value;
    else if (value && /^#[\da-f]{3}$/.test(value))
      style[key] =
        '#' + [...value.slice(1)].map((digit) => digit + digit).join('');
  }
  const decoration = values['text-decoration-line']?.trim().toLowerCase();
  if (
    decoration &&
    /^(?:none|(?:underline|line-through)(?: (?:underline|line-through))?)$/.test(
      decoration,
    )
  ) {
    style.underline = decoration.includes('underline');
    style.strike_through = decoration.includes('line-through');
  }
  return style;
}
const NUMBER_EM = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)em$/;
const NUMERIC_TOKENS = [
  ['font-size', 'relative_size', 0.5, 3],
  ['text-indent', 'indent_em', -3, 6],
  ['margin-inline-start', 'block_indent_em', 0, 6],
  ['margin-top', 'space_before_em', 0, 5],
  ['margin-bottom', 'space_after_em', 0, 5],
] as const;
const COLOR_TOKENS = [
  ['color', 'color'],
  ['background-color', 'background_color'],
  ['text-decoration-color', 'decoration_color'],
] as const;

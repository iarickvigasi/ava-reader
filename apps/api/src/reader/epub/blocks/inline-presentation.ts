import type { Style } from '../../../pdf-conversion/contracts/generated/ava-book-2';

// Block size/spacing stay on the block. Flat inline runs inherit only text styles.
export function inlinePresentation(style?: Style): Style | undefined {
  if (!style) return undefined;
  const result: Style = { id: 'epub-inline-presentation' };
  for (const key of TEXT_PROPERTIES)
    if (style[key] != null) Object.assign(result, { [key]: style[key] });
  return Object.keys(result).length > 1 ? result : undefined;
}
const TEXT_PROPERTIES = [
  'line_height',
  'family',
  'bold',
  'italic',
  'small_caps',
  'vertical_align',
  'color',
  'background_color',
  'decoration_color',
  'underline',
  'strike_through',
] as const;

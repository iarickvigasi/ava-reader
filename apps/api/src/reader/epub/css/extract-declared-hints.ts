import type { StylesheetClassHints } from './style-hint-types';
import { declaredPresentation } from './declared-presentation';
import {
  explicitFontSize,
  explicitFontWeight,
} from '../blocks/explicit-font-values';
import { resolveTextAlignFromStyle } from '../blocks/text-align';
import { resolveTextIndentValue } from '../blocks/text-indent';

export function extractDeclaredHints(
  declarations: Record<string, string>,
): StylesheetClassHints | null {
  const hints: StylesheetClassHints = {};
  const align = resolveTextAlignFromStyle(
    `text-align:${declarations['text-align'] ?? ''}`,
  );
  if (align) hints.align = align;
  const size = explicitFontSize(declarations['font-size']);
  if (size != null) hints.fontSizeScale = size;
  const weight = explicitFontWeight(declarations['font-weight']);
  if (weight != null) hints.fontWeight = weight;
  const indent = resolveTextIndentValue(
    declarations['text-indent']?.toLowerCase() ?? '',
  );
  if (indent != null) hints.textIndent = indent;
  const presentation = declaredPresentation(declarations);
  if (Object.keys(presentation).length > 1) hints.presentation = presentation;
  const whitespace = declarations['white-space']?.toLowerCase();
  if (
    whitespace === 'pre' ||
    whitespace === 'pre-wrap' ||
    whitespace === 'normal'
  )
    hints.literal = whitespace !== 'normal';
  return Object.keys(hints).length ? hints : null;
}

import type { Style } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import type { ReaderTextAlign } from '../blocks/text-align';

export type StylesheetClassHints = {
  align?: ReaderTextAlign;
  fontSizeScale?: number;
  fontWeight?: number;
  textIndent?: number;
  presentation?: Style;
  literal?: boolean;
};
export type StyleAncestor = { tagName: string; classNames: string[] };
export type StylesheetHintMap = {
  classHints: Map<string, StylesheetClassHints>;
  tagHints: Map<string, StylesheetClassHints>;
  orderedHints?: {
    selectors: string[];
    hints: StylesheetClassHints;
    specificity: [number, number];
    order: number;
  }[];
};

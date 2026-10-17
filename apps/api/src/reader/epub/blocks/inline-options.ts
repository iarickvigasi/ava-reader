import type { Style } from '../../../pdf-conversion/contracts/generated/ava-book-2';
import type { StyleAncestor, StylesheetHintMap } from '../css/style-hint-types';

export type InlineOptions = {
  literal?: boolean;
  language?: string;
  stylesheetHints?: StylesheetHintMap;
  presentation?: Style;
  ancestors?: StyleAncestor[];
};
export type InlineState = InlineOptions & {
  bold?: boolean;
  fontWeight?: number;
  href?: string;
  italic?: boolean;
  script?: 'super' | 'sub';
};

import type { Style } from '../pdf-conversion/contracts/generated/ava-book-2';
import type { ReaderInline } from './reader-inline-types';
import type { ReaderLinkTarget } from './reader-link-target';

export type ReaderBlockAlign = 'left' | 'center' | 'right' | 'justify';
export type ReaderBlockBase = {
  id: string;
  text: string;
  anchorId?: string | null;
  anchorIds?: string[];
  sourceAnchors?: { id: string; textOffset: number }[];
  align?: ReaderBlockAlign;
  fontSizeScale?: number;
  fontWeight?: number;
  textIndent?: number;
  presentation?: Style;
  preserveWhitespace?: boolean;
};
export type ReaderListItem = ReaderBlockBase & {
  inlines: ReaderInline[];
  children?: ReaderListBlock[];
};
export type ReaderListBlock = ReaderBlockBase & {
  kind: 'list';
  ordered: boolean;
  markerStyle?:
    | 'decimal'
    | 'lower-alpha'
    | 'upper-alpha'
    | 'lower-roman'
    | 'upper-roman'
    | 'bullet'
    | 'none';
  start?: number;
  items: ReaderListItem[];
};
export type ReaderTableCell = ReaderBlockBase & {
  row: number;
  column: number;
  rowSpan?: number;
  columnSpan?: number;
  headerAxis?: 'row' | 'column' | 'both' | null;
  headerIds: string[];
  inlines: ReaderInline[];
};
export type ReaderTextBlock = ReaderBlockBase & {
  kind:
    | 'paragraph'
    | 'blockquote'
    | 'aside'
    | 'caption'
    | 'credit'
    | 'verse'
    | 'code'
    | 'note';
  inlines: ReaderInline[];
  returns?: { label: string; target: ReaderLinkTarget }[];
  pendingReturns?: { label: string; href: string }[];
  noteRole?: 'footnote' | 'endnote';
};
export type ReaderBlock =
  | ReaderTextBlock
  | ReaderListBlock
  | (ReaderBlockBase & {
      kind: 'heading';
      level: number;
      inlines: ReaderInline[];
    })
  | (ReaderBlockBase & {
      kind: 'image';
      alt: string | null;
      src: string;
      href?: string;
      sourceOffset?: number;
      target?: ReaderLinkTarget;
      width?: number;
      height?: number;
      captionId?: string | null;
      creditId?: string | null;
    })
  | (ReaderBlockBase & {
      kind: 'table';
      cells: ReaderTableCell[];
      captionId?: string | null;
    })
  | (ReaderBlockBase & { kind: 'separator' });

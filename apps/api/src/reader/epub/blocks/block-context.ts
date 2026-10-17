import type { ReaderBlock } from '../../reader-types';
import type { EpubAsset } from '../archive';
import type { OrderedNode } from '../xml-utils';
import type {
  StyleAncestor,
  StylesheetHintMap,
} from '../css/build-stylesheet-hints';
import type { BlockStyleHints } from './block-style-hints';

export type NormalizeBlockOptions = {
  chapterId: string;
  createBlockId: () => string;
  resolveAsset: (assetPath: string) => Promise<EpubAsset | null>;
  stylesheetHints?: StylesheetHintMap;
  inheritedHints?: BlockStyleHints;
  ancestors?: StyleAncestor[];
  sourcePath?: number[];
  inlineTextKind?: 'paragraph' | 'blockquote';
};
export type BlockContext = NormalizeBlockOptions & {
  attrs: Record<string, string>;
  children: OrderedNode[];
  anchorId: string | null;
  hints: BlockStyleHints;
};
export type BlockResult = ReaderBlock | ReaderBlock[] | null;

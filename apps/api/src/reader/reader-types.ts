import type { ReaderBlock } from './reader-block-types';
export type { ReaderInline } from './reader-inline-types';
export type {
  ReaderBlock,
  ReaderBlockAlign,
  ReaderListItem,
  ReaderListBlock,
  ReaderTableCell,
  ReaderTextBlock,
} from './reader-block-types';

export type ReaderManifest = {
  authors: string[];
  language: string | null;
  sourceChecksum: string;
  title: string;
  totalBlocks: number;
  totalChapters: number;
};

export type ReaderTocNode = {
  anchorId: string | null;
  blockId: string | null;
  chapterId: string | null;
  children: ReaderTocNode[];
  href: string | null;
  id: string;
  label: string;
  spineIndex: number | null;
};

export type ReaderChapter = {
  blocks: ReaderBlock[];
  chapterId: string;
  href: string;
  label: string;
  previousChapterId: string | null;
  nextChapterId: string | null;
  spineIndex: number;
  title: string;
};

export type ReaderPackage = {
  chapters: ReaderChapter[];
  manifest: ReaderManifest;
  toc: ReaderTocNode[];
  version: 2;
};

export type ReaderLocator = {
  blockId: string;
  chapterId: string;
  textOffset: number;
};

export type {
  ReadingProgressIndex,
  ReadingProgressIndexChapter,
} from './reading-progress-types';

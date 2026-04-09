export type ReaderInline =
  | {
      kind: 'text';
      text: string;
      bold?: boolean;
      href?: string;
      italic?: boolean;
    }
  | {
      alt: string | null;
      href?: string;
      kind: 'image';
      src: string;
    };

export type ReaderListItem = {
  id: string;
  inlines: ReaderInline[];
  text: string;
};

export type ReaderBlock =
  | {
      anchorId?: string | null;
      id: string;
      inlines: ReaderInline[];
      kind: 'paragraph' | 'blockquote';
      text: string;
    }
  | {
      anchorId?: string | null;
      id: string;
      inlines: ReaderInline[];
      kind: 'heading';
      level: number;
      text: string;
    }
  | {
      anchorId?: string | null;
      id: string;
      items: ReaderListItem[];
      kind: 'list';
      ordered: boolean;
      text: string;
    }
  | {
      alt: string | null;
      anchorId?: string | null;
      id: string;
      kind: 'image';
      src: string;
      text: string;
    };

export type ReaderManifest = {
  author: string | null;
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
  version: 1 | 2;
};

export type ReaderLocator = {
  blockId: string;
  chapterId: string;
  textOffset: number;
};

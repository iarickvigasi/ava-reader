export type ReaderInline =
  | {
      kind: 'text';
      text: string;
      bold?: boolean;
      // Numeric CSS font-weight (100..900). Set when the source
      // explicitly specifies a weight via `style="font-weight:…"` or
      // a stylesheet rule. Takes precedence over `bold` on the
      // frontend when both are present.
      fontWeight?: number;
      href?: string;
      italic?: boolean;
    }
  | {
      alt: string | null;
      href?: string;
      kind: 'image';
      // Intrinsic pixel width read from the source asset. Null when the
      // format isn't introspected (e.g. SVG). The block builder uses
      // this to decide whether the image is a drop-cap that stays
      // inline or an illustration that gets promoted to a block.
      naturalWidth?: number | null;
      src: string;
    };

export type ReaderListItem = {
  id: string;
  inlines: ReaderInline[];
  text: string;
};

export type ReaderBlockAlign = 'left' | 'center' | 'right' | 'justify';

export type ReaderBlock =
  | {
      align?: ReaderBlockAlign;
      anchorId?: string | null;
      fontSizeScale?: number;
      fontWeight?: number;
      id: string;
      inlines: ReaderInline[];
      kind: 'paragraph' | 'blockquote';
      text: string;
      textIndent?: number;
    }
  | {
      align?: ReaderBlockAlign;
      anchorId?: string | null;
      fontSizeScale?: number;
      fontWeight?: number;
      id: string;
      inlines: ReaderInline[];
      kind: 'heading';
      level: number;
      text: string;
      textIndent?: number;
    }
  | {
      align?: ReaderBlockAlign;
      anchorId?: string | null;
      fontSizeScale?: number;
      fontWeight?: number;
      id: string;
      items: ReaderListItem[];
      kind: 'list';
      ordered: boolean;
      text: string;
      textIndent?: number;
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
  version: 1 | 2;
};

export type ReaderLocator = {
  blockId: string;
  chapterId: string;
  textOffset: number;
};

import type { BookFileFormat } from "./shared";

export type ReaderInline =
  | {
      kind: "text";
      text: string;
      bold?: boolean;
      fontWeight?: number;
      href?: string;
      italic?: boolean;
    }
  | {
      alt: string | null;
      href?: string;
      kind: "image";
      naturalWidth?: number | null;
      src: string;
    };

export type ReaderListItem = {
  id: string;
  inlines: ReaderInline[];
  text: string;
};

export type ReaderBlockAlign = "left" | "center" | "right" | "justify";

export type ReaderBlock =
  | {
      align?: ReaderBlockAlign;
      anchorId?: string | null;
      fontSizeScale?: number;
      fontWeight?: number;
      id: string;
      inlines: ReaderInline[];
      kind: "paragraph" | "blockquote";
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
      kind: "heading";
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
      kind: "list";
      ordered: boolean;
      text: string;
      textIndent?: number;
    }
  | {
      alt: string | null;
      anchorId?: string | null;
      id: string;
      kind: "image";
      src: string;
      text: string;
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

export type ReaderChapterPayload = {
  blocks: ReaderBlock[];
  chapterId: string;
  href: string;
  label: string;
  nextChapterId: string | null;
  previousChapterId: string | null;
  spineIndex: number;
  title: string;
};

export type ReaderLocator = {
  blockId: string;
  chapterId: string;
  textOffset: number;
};

// Position fingerprint for a selection inside a chapter. The (blockId,
// offset) pair is the primary anchor; contextBefore/contextAfter are the
// fallback when block IDs drift after a re-import (text-quote-selector
// style). Serialized as JSON into the persistence layer (AiComment.locator
// and Annotation.locator).
export type ReaderRangeLocator = {
  chapterId: string;
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
  contextBefore: string;
  contextAfter: string;
};

export type ReaderProgressPayload = {
  chapterLabel: string | null;
  completionPercent: number;
  lastReadAt: string | null;
  locator: ReaderLocator | null;
};

export type ReaderSessionPayload = {
  durationSeconds: number;
  endedAt: string | null;
  lastTrackedAt: string | null;
  sessionId: string;
  startedAt: string;
};

export type ReaderBookPayload = {
  authors: string[];
  libraryItemId: string;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
};

export type ReaderStatusPayload =
  | {
      activeChapterId: string;
      book: ReaderBookPayload;
      chapters: ReaderChapterPayload[];
      progress: ReaderProgressPayload;
      status: "READY";
      toc: ReaderTocNode[];
    }
  | {
      book: ReaderBookPayload;
      message: string;
      progress: ReaderProgressPayload;
      status: "FAILED" | "PROCESSING" | "UNSUPPORTED";
    };

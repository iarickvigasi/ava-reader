import type { ReaderBookPayload } from "./reader-book";

export type { ReaderBookPayload } from "./reader-book";

import type { ReaderBlock } from "./reader-content";
import type { ReaderPackageV3 } from "./canonical-reader.generated";
export type {
  ReaderBlock,
  ReaderInline,
  ReaderListItem,
  ReaderBlockAlign,
} from "./reader-content";

export type ReaderTocNode = {
  anchorId: string | null;
  blockId: string | null;
  chapterId: string | null;
  children: ReaderTocNode[];
  href: string | null;
  id: string;
  label: string;
  spineIndex: number | null;
  textOffset?: number;
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
  // The outer offsets always anchor to the original book. Translated text has
  // its own sentence-relative offsets and identity; never use those as source offsets.
  translation?: {
    targetLang: string;
    contentRevision: string;
    startSentenceId: string;
    endSentenceId: string;
    startOffset: number;
    endOffset: number;
  };
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

export type ReaderStatusPayload =
  | {
      activeChapterId: string;
      readerPackage?: ReaderPackageV3;
      resourceUrls?: Record<string, string>;
      // Client-only availability; accepted canonical content is never changed.
      resourceRequests?: Record<string, string>;
      resourceFailures?: string[];
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

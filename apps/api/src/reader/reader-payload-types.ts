import type { BookFileFormat } from '@prisma/client';
import type {
  ReaderChapter,
  ReaderLocator,
  ReaderTocNode,
} from './reader-types';

export type ReaderProgressSummary = {
  chapterLabel: string | null;
  completionPercent: number;
  lastReadAt: string | null;
  locator: ReaderLocator | null;
};

export type ReaderBookPayload = {
  authors: string[];
  libraryItemId: string;
  primaryFormat: BookFileFormat;
  slug: string;
  title: string;
};

type ReaderReadyPayload = {
  activeChapterId: string;
  book: ReaderBookPayload;
  chapters: ReaderChapter[];
  progress: ReaderProgressSummary;
  status: 'READY';
  toc: ReaderTocNode[];
};

export type ReaderStatusPayload =
  | ReaderReadyPayload
  | {
      book: ReaderBookPayload;
      message: string;
      progress: ReaderProgressSummary;
      status: 'FAILED' | 'PROCESSING' | 'UNSUPPORTED';
    };

export type ReaderSessionPayload = {
  durationSeconds: number;
  endedAt: string | null;
  lastTrackedAt: string | null;
  sessionId: string;
  startedAt: string;
};

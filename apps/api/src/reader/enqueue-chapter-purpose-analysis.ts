import type { Logger } from '@nestjs/common';
import { requestChapterPurposeAnalysis } from '../book-analysis/chapter-purpose/request-analysis';
import type { PrismaService } from '../prisma/prisma.service';

// Lazily analyse on first read: a bulk import of forty EPUBs costs nothing,
// and only the books someone actually opens are ever paid for. Deliberately
// not awaited — the payload must not wait on it, and the helper swallows its
// own errors.
export function enqueueChapterPurposeAnalysis(params: {
  bookId: string;
  logger: Logger;
  prisma: PrismaService;
  readerFileId: string;
}) {
  void requestChapterPurposeAnalysis({
    bookId: params.bookId,
    prisma: params.prisma,
    readerFileId: params.readerFileId,
  }).catch((error: unknown) => {
    // Analysis is a refinement; a book opens with or without it. Logged
    // rather than swallowed so a persistently failing enqueue is visible.
    params.logger.warn(
      `Could not queue chapter-purpose analysis for book ${params.bookId}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  });
}

import {
  BookAnalysisKind,
  BookFileKind,
  ProcessingStatus,
} from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { CHAPTER_PURPOSE_PROMPT_VERSION } from './prompt';

/**
 * Charges a failed attempt to whichever reader file is currently primary.
 *
 * Best-effort throughout: the caller still has to close the processing run, so
 * a book with no reader file (or a database hiccup here) must not throw and
 * leave the pipeline stalled on a PROCESSING row.
 */
export async function recordFailedAttempt(input: {
  bookId: string;
  errorMessage: string;
  prisma: PrismaService;
}): Promise<void> {
  const readerFile = await input.prisma.bookFile
    .findFirst({
      where: {
        bookId: input.bookId,
        isPrimary: true,
        kind: BookFileKind.DERIVED_READER,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    .catch(() => null);

  if (!readerFile) {
    return;
  }

  await recordChapterPurposeFailure({
    ...input,
    readerFileId: readerFile.id,
  }).catch(() => undefined);
}

/**
 * Records a failure against the reader file that was being analysed. The
 * attempt counter resets whenever that file changes, so re-importing a book
 * that previously failed gives it a fresh set of retries.
 */
async function recordChapterPurposeFailure(input: {
  bookId: string;
  errorMessage: string;
  prisma: PrismaService;
  readerFileId: string;
}): Promise<void> {
  const { bookId, errorMessage, prisma, readerFileId } = input;
  const existing = await prisma.bookAnalysis.findUnique({
    where: { bookId_kind: { bookId, kind: BookAnalysisKind.CHAPTER_PURPOSE } },
    select: { attempts: true, readerFileId: true },
  });
  const attempts =
    existing?.readerFileId === readerFileId ? existing.attempts + 1 : 1;

  await prisma.bookAnalysis.upsert({
    where: { bookId_kind: { bookId, kind: BookAnalysisKind.CHAPTER_PURPOSE } },
    create: {
      attempts,
      bookId,
      errorMessage,
      kind: BookAnalysisKind.CHAPTER_PURPOSE,
      promptVersion: CHAPTER_PURPOSE_PROMPT_VERSION,
      readerFileId,
      status: ProcessingStatus.FAILED,
    },
    update: {
      attempts,
      errorMessage,
      readerFileId,
      status: ProcessingStatus.FAILED,
    },
  });
}

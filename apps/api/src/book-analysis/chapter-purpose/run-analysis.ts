import {
  BookAnalysisKind,
  BookFileKind,
  ProcessingStatus,
} from '@prisma/client';
import type { LanguageModel } from 'ai';
import type { PrismaService } from '../../prisma/prisma.service';
import { parseReaderPackage } from '../../reader/package/parse-reader-package';
import {
  buildReadingProgressIndex,
  parseStoredReadingProgressIndex,
} from '../../reader/progress/reading-progress-index';
import type { ReaderPackage } from '../../reader/reader-types';
import {
  analyseChapterPurposes,
  type ChapterPurposeAnalysis,
} from './chapter-purpose';
import { persistChapterPurposeAnalysis } from './persist-analysis';
import { CHAPTER_PURPOSE_SCHEMA_VERSION } from './schema';

// A single chapter has nothing to be distinguished from, so there is no
// classification to make and no reason to spend a request.
const MIN_CHAPTERS_TO_ANALYSE = 2;

export async function runChapterPurposeAnalysis(input: {
  bookId: string;
  model: LanguageModel;
  modelId: string;
  prisma: PrismaService;
}): Promise<void> {
  const { bookId, prisma } = input;
  const readerFile = await prisma.bookFile.findFirst({
    where: { bookId, isPrimary: true, kind: BookFileKind.DERIVED_READER },
    select: { blobId: true, id: true, readingProgressIndex: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!readerFile) {
    throw new Error('The book has no primary reader package to analyse.');
  }

  // Enqueueing is check-then-create with no uniqueness constraint, so two
  // near-simultaneous opens of the same book can both queue a run. Re-checking
  // here — the last point before any spend — means the loser costs a single
  // indexed read rather than a second AI call.
  if (await hasFreshAnalysis(prisma, bookId, readerFile.id)) {
    return;
  }

  const blob = await prisma.storedBlob.findUniqueOrThrow({
    where: { id: readerFile.blobId },
    select: { bytes: true },
  });
  const readerPackage = parseReaderPackage(Buffer.from(blob.bytes));

  const analysis =
    readerPackage.chapters.length < MIN_CHAPTERS_TO_ANALYSE
      ? countEverything(readerPackage)
      : await analyseChapterPurposes({
          model: input.model,
          readerPackage,
        });

  await persistChapterPurposeAnalysis({
    analysis,
    bookId,
    index:
      parseStoredReadingProgressIndex(readerFile.readingProgressIndex) ??
      buildReadingProgressIndex(readerPackage),
    modelId: input.modelId,
    prisma,
    readerFileId: readerFile.id,
    readerPackage,
  });
}

async function hasFreshAnalysis(
  prisma: PrismaService,
  bookId: string,
  readerFileId: string,
): Promise<boolean> {
  const existing = await prisma.bookAnalysis.findUnique({
    where: { bookId_kind: { bookId, kind: BookAnalysisKind.CHAPTER_PURPOSE } },
    select: { readerFileId: true, status: true },
  });

  return (
    existing?.status === ProcessingStatus.READY &&
    existing.readerFileId === readerFileId
  );
}

// Persisted rather than skipped: a READY row is what stops the read path
// re-enqueueing this book on every open.
function countEverything(readerPackage: ReaderPackage): ChapterPurposeAnalysis {
  return {
    chapters: readerPackage.chapters.map((chapter) => ({
      chapterId: chapter.chapterId,
      confidence: 'low',
      counted: true,
      purpose: 'BODY',
    })),
    lowConfidence: true,
    version: CHAPTER_PURPOSE_SCHEMA_VERSION,
  };
}

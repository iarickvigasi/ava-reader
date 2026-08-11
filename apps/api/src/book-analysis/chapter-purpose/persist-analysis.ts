import { BookAnalysisKind, Prisma, ProcessingStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type {
  ReaderPackage,
  ReadingProgressIndex,
} from '../../reader/reader-types';
import { applyPurposesToIndex } from './apply-to-index';
import { estimateBodyPageCount } from './body-page-count';
import type { ChapterPurposeAnalysis } from './chapter-purpose';
import { CHAPTER_PURPOSE_PROMPT_VERSION } from './prompt';
import { CHAPTER_PURPOSE_SCHEMA_VERSION } from './schema';

export async function persistChapterPurposeAnalysis(input: {
  analysis: ChapterPurposeAnalysis;
  bookId: string;
  index: ReadingProgressIndex;
  modelId: string;
  prisma: PrismaService;
  readerFileId: string;
  readerPackage: ReaderPackage;
}): Promise<void> {
  const { analysis, bookId, prisma, readerFileId } = input;
  const nextIndex = applyPurposesToIndex(input.index, analysis);
  const bodyPageCount = estimateBodyPageCount(input.readerPackage, analysis);

  await prisma.$transaction([
    prisma.bookAnalysis.upsert({
      where: {
        bookId_kind: { bookId, kind: BookAnalysisKind.CHAPTER_PURPOSE },
      },
      create: {
        attempts: 0,
        bookId,
        kind: BookAnalysisKind.CHAPTER_PURPOSE,
        modelId: input.modelId,
        promptVersion: CHAPTER_PURPOSE_PROMPT_VERSION,
        result: analysis as unknown as Prisma.InputJsonValue,
        schemaVersion: CHAPTER_PURPOSE_SCHEMA_VERSION,
        readerFileId,
        status: ProcessingStatus.READY,
      },
      update: {
        attempts: 0,
        errorMessage: null,
        modelId: input.modelId,
        promptVersion: CHAPTER_PURPOSE_PROMPT_VERSION,
        result: analysis as unknown as Prisma.InputJsonValue,
        schemaVersion: CHAPTER_PURPOSE_SCHEMA_VERSION,
        readerFileId,
        status: ProcessingStatus.READY,
      },
    }),
    prisma.bookFile.update({
      where: { id: input.readerFileId },
      data: {
        readingProgressIndex: nextIndex as unknown as Prisma.InputJsonValue,
      },
    }),
    prisma.book.update({
      where: { id: bookId },
      data: { estimatedBodyPageCount: bodyPageCount },
    }),
  ]);
}

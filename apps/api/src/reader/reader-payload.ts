import { BadRequestException, type Logger } from '@nestjs/common';
import { BookFileFormat, BookFileKind, ProcessingStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { toBookPayload } from './book-payload';
import { enqueueChapterPurposeAnalysis } from './enqueue-chapter-purpose-analysis';
import {
  findReadyDerivedReader,
  type OwnedLibraryItem,
} from './library-item-access';
import { loadReaderPackage } from './package/load-reader-package';
import { selectChapter, selectChapterWindow } from './package/select-chapter';
import { createProgressSummary } from './progress/progress-summary';
import type { ReaderStatusPayload } from './reader-payload-types';

// The four reader statuses and what produces each are specified in
// docs/specs/1-reader/1.7-reader-payload.md.
export async function buildReaderPayload(params: {
  chapterId?: string;
  libraryItem: OwnedLibraryItem;
  logger: Logger;
  prisma: PrismaService;
}): Promise<ReaderStatusPayload> {
  const { chapterId, libraryItem, logger, prisma } = params;

  const sourceFile = libraryItem.book.files.find(
    (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
  );
  const progress = createProgressSummary(libraryItem.progress);

  if (!sourceFile || sourceFile.format !== BookFileFormat.EPUB) {
    return {
      book: toBookPayload(
        libraryItem,
        sourceFile?.format ?? BookFileFormat.UNKNOWN,
      ),
      message: 'This reader currently supports EPUB books only.',
      progress,
      status: 'UNSUPPORTED',
    };
  }

  const book = toBookPayload(libraryItem, sourceFile.format);
  const derivedReader = findReadyDerivedReader(libraryItem);

  if (!derivedReader) {
    const latestRun = libraryItem.book.processingRuns[0] ?? null;

    if (latestRun?.status === ProcessingStatus.FAILED) {
      return {
        book,
        message:
          latestRun.errorMessage ??
          'The EPUB could not be prepared for the reader.',
        progress,
        status: 'FAILED',
      };
    }

    return {
      book,
      message: 'Preparing this EPUB for the reader.',
      progress,
      status: 'PROCESSING',
    };
  }

  enqueueChapterPurposeAnalysis({
    bookId: libraryItem.book.id,
    logger,
    prisma,
    readerFileId: derivedReader.id,
  });

  const readerPackage = await loadReaderPackage(prisma, derivedReader.blobId);
  const selectedChapter =
    selectChapter(readerPackage, chapterId) ??
    selectChapter(readerPackage, progress.locator?.chapterId) ??
    readerPackage.chapters[0];

  if (!selectedChapter) {
    throw new BadRequestException(
      'The derived reader package has no chapters.',
    );
  }

  return {
    activeChapterId: selectedChapter.chapterId,
    book,
    chapters: selectChapterWindow(readerPackage, selectedChapter.chapterId),
    progress,
    status: 'READY',
    toc: readerPackage.toc,
  };
}

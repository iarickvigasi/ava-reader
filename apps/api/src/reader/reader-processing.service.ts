import {
  BlobPurpose,
  BookFileFormat,
  BookFileKind,
  ProcessingStatus,
} from '@prisma/client';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../shared/blob-utils';
import { buildReaderPackageFromEpub } from './epub-reader-package';
import { estimatePageCount } from './page-estimate';
import { buildReadingProgressIndex } from './progress/reading-progress-index';

const READER_PACKAGE_MIME_TYPE = 'application/vnd.ava.reader-package+json';
const READER_PROCESSING_TRANSACTION_TIMEOUT_MS = 30_000;

@Injectable()
export class ReaderProcessingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReaderProcessingService.name);
  private poller: NodeJS.Timeout | null = null;
  private isTickRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.poller = setInterval(() => {
      void this.processPendingRunsOnce();
    }, 2_000);
  }

  onModuleDestroy() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  async processPendingRunsOnce() {
    if (this.isTickRunning) {
      return false;
    }

    this.isTickRunning = true;

    try {
      const pendingRun = await this.prisma.bookProcessingRun.findFirst({
        where: {
          pipeline: 'normalize-reader-package-v1',
          status: ProcessingStatus.PENDING,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (!pendingRun) {
        return false;
      }

      const claimed = await this.prisma.bookProcessingRun.updateMany({
        where: {
          id: pendingRun.id,
          status: ProcessingStatus.PENDING,
        },
        data: {
          completedAt: null,
          errorMessage: null,
          status: ProcessingStatus.PROCESSING,
        },
      });

      if (claimed.count === 0) {
        return false;
      }

      await this.processRunById(pendingRun.id);
      return true;
    } finally {
      this.isTickRunning = false;
    }
  }

  private async processRunById(runId: string) {
    const run = await this.prisma.bookProcessingRun.findUnique({
      where: { id: runId },
      include: {
        book: {
          include: {
            files: {
              include: {
                blob: true,
              },
            },
          },
        },
      },
    });

    if (!run) {
      return;
    }

    const sourceFile = run.book.files.find(
      (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
    );

    if (!sourceFile) {
      await this.markRunFailed(runId, 'A primary source file was not found.');
      return;
    }

    if (sourceFile.format !== BookFileFormat.EPUB) {
      await this.markRunFailed(runId, 'Only EPUB source files are supported.');
      return;
    }

    let createdBlobId: string | null = null;
    try {
      const readerPackage = await buildReaderPackageFromEpub({
        authors: run.book.authors,
        buffer: Buffer.from(sourceFile.blob.bytes),
        checksum: sourceFile.blob.checksum,
        language: run.book.language,
        title: run.book.title,
      });
      const estimatedPageCount = estimatePageCount(readerPackage);
      const packageBytes = Buffer.from(JSON.stringify(readerPackage), 'utf8');
      const checksum = checksumBuffer(packageBytes);
      const readingProgressIndex = buildReadingProgressIndex(readerPackage);

      // Write the package blob outside the metadata transaction. For large
      // books the bytes payload runs to tens of MB and a single insert can
      // exceed the interactive-transaction timeout; it would also pin a DB
      // connection plus row locks for the entire write. Same pattern as
      // LibraryService.importBook — orphan blobs are best-effort cleaned up
      // below on failure, with OrphanBlobCleanupService as backstop.
      const blob = await this.prisma.storedBlob.create({
        data: {
          bytes: toPrismaBytes(packageBytes),
          checksum,
          mimeType: READER_PACKAGE_MIME_TYPE,
          originalFilename: `${run.bookId}-reader-package.json`,
          purpose: BlobPurpose.DERIVED_READER,
          sizeBytes: packageBytes.byteLength,
        },
      });
      createdBlobId = blob.id;

      await this.prisma.$transaction(
        async (tx) => {
          await tx.book.update({
            where: {
              id: run.bookId,
            },
            data: {
              estimatedPageCount,
            },
          });

          await tx.bookFile.updateMany({
            where: {
              bookId: run.bookId,
              isPrimary: true,
              kind: BookFileKind.DERIVED_READER,
            },
            data: {
              isPrimary: false,
            },
          });

          const outputFile = await tx.bookFile.create({
            data: {
              blobId: blob.id,
              bookId: run.bookId,
              format: BookFileFormat.READER_PACKAGE,
              isPrimary: true,
              kind: BookFileKind.DERIVED_READER,
              processingStatus: ProcessingStatus.READY,
              readingProgressIndex:
                readingProgressIndex as unknown as Prisma.InputJsonValue,
            },
          });

          await tx.bookProcessingRun.update({
            where: { id: runId },
            data: {
              completedAt: new Date(),
              errorMessage: null,
              outputFileId: outputFile.id,
              sourceFileId: sourceFile.id,
              status: ProcessingStatus.READY,
            },
          });
        },
        {
          timeout: READER_PROCESSING_TRANSACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (createdBlobId) {
        await this.prisma.storedBlob
          .delete({ where: { id: createdBlobId } })
          .catch(() => {
            // Sweeper will collect it.
          });
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown EPUB processing error.';
      this.logger.warn(`Reader processing failed for ${runId}: ${message}`);
      await this.markRunFailed(runId, message);
    }
  }

  private async markRunFailed(runId: string, errorMessage: string) {
    await this.prisma.bookProcessingRun.update({
      where: { id: runId },
      data: {
        completedAt: new Date(),
        errorMessage,
        status: ProcessingStatus.FAILED,
      },
    });
  }
}

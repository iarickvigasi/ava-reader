import {
  BookFileFormat,
  BookFileKind,
  ProcessingStatus,
  type Prisma,
} from '@prisma/client';
import { normalizeBookLanguage } from '../../shared/book-utils';
import type { ExtractedBookMetadata } from '../../shared/metadata-extractor';

// Creates the Book row with its primary SOURCE file and, for EPUBs, the
// processing run that derives the reader package
// (docs/specs/7-library/7.4-import.md).
export function createBookTx(
  tx: Prisma.TransactionClient,
  input: {
    blobId: string;
    coverBlobId: string | undefined;
    format: 'EPUB' | 'PDF';
    metadata: ExtractedBookMetadata;
  },
) {
  return tx.book.create({
    data: {
      title: input.metadata.title,
      authors: input.metadata.authors,
      description: input.metadata.description,
      genres: input.metadata.genres,
      language: normalizeBookLanguage(input.metadata.language),
      publishedYear: input.metadata.publishedYear,
      coverBlobId: input.coverBlobId,
      files: {
        create: {
          blobId: input.blobId,
          format: input.format,
          kind: BookFileKind.SOURCE,
          processingStatus: ProcessingStatus.READY,
          isPrimary: true,
        },
      },
      processingRuns:
        input.format === BookFileFormat.EPUB
          ? {
              create: {
                pipeline: 'normalize-reader-package-v1',
                status: ProcessingStatus.PENDING,
              },
            }
          : undefined,
    },
  });
}

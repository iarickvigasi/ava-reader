import type { Express } from 'express';
import {
  BlobPurpose,
  BookFileFormat,
  BookFileKind,
  LibrarySource,
  Prisma,
  ProcessingStatus,
} from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { checksumBuffer, toPrismaBytes } from '../shared/blob-utils';
import {
  DEFAULT_SMART_COLLECTIONS,
  getSmartCollectionKey,
} from '../shared/default-collections';
import {
  detectBookFileFormat,
  extractBookMetadata,
  isSupportedSourceFormat,
} from '../shared/metadata-extractor';

type TransactionClient = Prisma.TransactionClient;

export type LibraryMutationPayload = {
  addedAt: string;
  book: {
    author: string | null;
    format: BookFileFormat;
    id: string;
    title: string;
  };
  libraryItemId: string;
  source: LibrarySource;
  state: 'added' | 'existing';
};

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async importBook(clerkUserId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A book file is required.');
    }

    const format = detectBookFileFormat(file);

    if (!isSupportedSourceFormat(format)) {
      throw new BadRequestException('Only EPUB and PDF files are supported.');
    }

    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const metadata = await extractBookMetadata(file);

    return this.prisma.$transaction(async (tx) => {
      const blob = await tx.storedBlob.create({
        data: {
          purpose: BlobPurpose.BOOK_SOURCE,
          mimeType: file.mimetype || inferMimeType(format),
          sizeBytes: file.size,
          originalFilename: file.originalname,
          checksum: checksumBuffer(file.buffer),
          bytes: toPrismaBytes(file.buffer),
        },
      });

      const coverBlob = metadata.coverImage
        ? await tx.storedBlob.create({
            data: {
              purpose: BlobPurpose.BOOK_COVER,
              mimeType: metadata.coverImage.mimeType,
              sizeBytes: metadata.coverImage.bytes.byteLength,
              originalFilename: metadata.coverImage.originalFilename,
              checksum: checksumBuffer(metadata.coverImage.bytes),
              bytes: toPrismaBytes(metadata.coverImage.bytes),
            },
          })
        : null;

      const book = await tx.book.create({
        data: {
          title: metadata.title,
          author: metadata.author,
          description: metadata.description,
          language: metadata.language,
          publishedYear: metadata.publishedYear,
          coverBlobId: coverBlob?.id,
          files: {
            create: {
              blobId: blob.id,
              format,
              kind: BookFileKind.SOURCE,
              processingStatus: ProcessingStatus.READY,
              isPrimary: true,
            },
          },
          processingRuns:
            format === BookFileFormat.EPUB
              ? {
                  create: {
                    pipeline: 'normalize-reader-package-v1',
                    status: ProcessingStatus.PENDING,
                  },
                }
              : undefined,
        },
      });

      return this.addBookToUserLibraryTx(tx, {
        bookId: book.id,
        source: LibrarySource.IMPORTED,
        userId: user.id,
      });
    });
  }

  async addCatalogBookToLibrary(clerkUserId: string, entryId: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.catalogEntry.findFirst({
        where: {
          id: entryId,
          status: 'PUBLISHED',
        },
        include: {
          book: true,
        },
      });

      if (!entry) {
        throw new BadRequestException(
          'The requested catalog book is not available.',
        );
      }

      return this.addBookToUserLibraryTx(tx, {
        bookId: entry.bookId,
        originCatalogEntryId: entry.id,
        source: LibrarySource.CATALOG,
        userId: user.id,
      });
    });
  }

  private async addBookToUserLibraryTx(
    tx: TransactionClient,
    input: {
      bookId: string;
      originCatalogEntryId?: string;
      source: LibrarySource;
      userId: string;
    },
  ): Promise<LibraryMutationPayload> {
    await this.ensureDefaultCollectionsTx(tx, input.userId);

    const existing = await tx.libraryItem.findUnique({
      where: {
        userId_bookId: {
          userId: input.userId,
          bookId: input.bookId,
        },
      },
      include: {
        book: {
          include: {
            files: true,
          },
        },
        progress: true,
      },
    });

    const libraryItem =
      existing ??
      (await tx.libraryItem.create({
        data: {
          userId: input.userId,
          bookId: input.bookId,
          source: input.source,
          originCatalogEntryId: input.originCatalogEntryId,
          progress: {
            create: {
              userId: input.userId,
            },
          },
        },
        include: {
          book: {
            include: {
              files: true,
            },
          },
          progress: true,
        },
      }));

    if (
      existing &&
      input.originCatalogEntryId &&
      !existing.originCatalogEntryId
    ) {
      await tx.libraryItem.update({
        where: { id: existing.id },
        data: {
          originCatalogEntryId: input.originCatalogEntryId,
        },
      });
    }

    if (!libraryItem.progress) {
      await tx.readingProgress.create({
        data: {
          libraryItemId: libraryItem.id,
          userId: input.userId,
        },
      });
    }

    await this.ensureCollectionMembershipTx(tx, {
      libraryItemId: libraryItem.id,
      source: input.source,
      userId: input.userId,
    });

    const primaryFile =
      libraryItem.book.files?.find((file) => file.isPrimary) ?? null;

    return {
      addedAt: libraryItem.addedAt.toISOString(),
      book: {
        author: libraryItem.book.author,
        format: primaryFile?.format ?? BookFileFormat.UNKNOWN,
        id: libraryItem.book.id,
        title: libraryItem.book.title,
      },
      libraryItemId: libraryItem.id,
      source: input.source,
      state: existing ? 'existing' : 'added',
    };
  }

  private async ensureDefaultCollectionsTx(
    tx: TransactionClient,
    userId: string,
  ) {
    for (const collection of DEFAULT_SMART_COLLECTIONS) {
      await tx.collection.upsert({
        where: {
          userId_smartKey: {
            userId,
            smartKey: collection.smartKey,
          },
        },
        update: {
          description: collection.description,
          kind: 'SMART',
          name: collection.name,
          sortOrder: collection.sortOrder,
        },
        create: {
          userId,
          smartKey: collection.smartKey,
          description: collection.description,
          kind: 'SMART',
          name: collection.name,
          sortOrder: collection.sortOrder,
        },
      });
    }
  }

  private async ensureCollectionMembershipTx(
    tx: TransactionClient,
    input: {
      libraryItemId: string;
      source: LibrarySource;
      userId: string;
    },
  ) {
    const smartKey = getSmartCollectionKey(input.source);
    const collection = await tx.collection.findUnique({
      where: {
        userId_smartKey: {
          userId: input.userId,
          smartKey,
        },
      },
    });

    if (!collection) {
      return;
    }

    await tx.collectionItem.upsert({
      where: {
        collectionId_libraryItemId: {
          collectionId: collection.id,
          libraryItemId: input.libraryItemId,
        },
      },
      update: {},
      create: {
        collectionId: collection.id,
        libraryItemId: input.libraryItemId,
      },
    });
  }
}

function inferMimeType(format: BookFileFormat) {
  if (format === BookFileFormat.EPUB) {
    return 'application/epub+zip';
  }

  if (format === BookFileFormat.PDF) {
    return 'application/pdf';
  }

  return 'application/octet-stream';
}

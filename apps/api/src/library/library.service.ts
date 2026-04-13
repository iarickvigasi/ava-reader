import type { Express } from 'express';
import {
  BlobPurpose,
  BookFileFormat,
  BookFileKind,
  LibrarySource,
  Prisma,
  ProcessingStatus,
} from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  bufferToDataUrl,
  checksumBuffer,
  toPrismaBytes,
} from '../shared/blob-utils';
import { UsersService } from '../users/users.service';
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
const LIBRARY_COLLECTION_PREVIEW_LIMIT = 4;

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

type LibraryCollectionRecord = Prisma.CollectionGetPayload<{
  include: {
    items: {
      include: {
        libraryItem: {
          include: {
            book: {
              include: {
                coverBlob: true;
                files: true;
              };
            };
            progress: true;
          };
        };
      };
    };
  };
}>;

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

  async getLibrary(clerkUserId: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);

    const collections = await this.prisma.collection.findMany({
      where: {
        userId: user.id,
      },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                book: {
                  include: {
                    coverBlob: true,
                    files: true,
                  },
                },
                progress: true,
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return {
      collections: collections.map((collection) =>
        serializeCollection(collection, {
          previewBooksLimit: LIBRARY_COLLECTION_PREVIEW_LIMIT,
        }),
      ),
      summary: {
        booksCount: collections.reduce(
          (sum, collection) =>
            sum +
            collection.items.filter((item) => !item.libraryItem.isArchived)
              .length,
          0,
        ),
        collectionsCount: collections.length,
      },
    };
  }

  async getCollection(clerkUserId: string, collectionId: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);

    const collection = await this.prisma.collection.findFirst({
      where: {
        id: collectionId,
        userId: user.id,
      },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                book: {
                  include: {
                    coverBlob: true,
                    files: true,
                  },
                },
                progress: true,
              },
            },
          },
        },
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found.');
    }

    return {
      collection: serializeCollection(collection),
    };
  }

  async renameCollection(
    clerkUserId: string,
    collectionId: string,
    input: {
      description?: null | string;
      name?: string;
    },
  ) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const name = input.name?.trim() ?? '';

    if (!name) {
      throw new BadRequestException('Collection name is required.');
    }

    const collection = await this.prisma.collection.findFirst({
      where: {
        id: collectionId,
        userId: user.id,
      },
      select: {
        description: true,
        id: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found.');
    }

    const description =
      input.description === undefined
        ? collection.description
        : normalizeCollectionDescription(input.description);

    try {
      const renamed = await this.prisma.collection.update({
        where: {
          id: collection.id,
        },
        data: {
          description,
          name,
        },
        select: {
          description: true,
          id: true,
          name: true,
        },
      });

      return {
        collectionId: renamed.id,
        description: renamed.description,
        name: renamed.name,
      };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new BadRequestException(
          'A collection with this name already exists.',
        );
      }

      throw error;
    }
  }

  async deleteCollection(clerkUserId: string, collectionId: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const result = await this.prisma.collection.deleteMany({
      where: {
        id: collectionId,
        userId: user.id,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Collection not found.');
    }

    return {
      collectionId,
      state: 'deleted' as const,
    };
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

function serializeCollection(
  collection: LibraryCollectionRecord,
  input?: {
    previewBooksLimit?: number;
  },
) {
  const activeItems = collection.items
    .map((item) => item.libraryItem)
    .filter((item) => !item.isArchived)
    .sort(compareLibraryItemsByEngagement);
  const serializedBooks = activeItems.map((item) => {
    const primarySource =
      item.book.files.find(
        (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
      ) ??
      item.book.files.find((file) => file.isPrimary) ??
      null;

    return {
      author: item.book.author,
      completionPercent: item.progress?.completionPercent ?? 0,
      coverImageDataUrl: item.book.coverBlob
        ? bufferToDataUrl(
            item.book.coverBlob.bytes,
            item.book.coverBlob.mimeType,
          )
        : null,
      lastReadAt: getMostRecentLibraryItemEngagementDate(item).toISOString(),
      libraryItemId: item.id,
      primaryFormat: primarySource?.format ?? BookFileFormat.UNKNOWN,
      title: item.book.title,
    };
  });

  const books =
    typeof input?.previewBooksLimit === 'number'
      ? serializedBooks.slice(0, input.previewBooksLimit)
      : serializedBooks;

  return {
    books,
    description: collection.description,
    id: collection.id,
    itemCount: activeItems.length,
    kind: collection.kind,
    name: collection.name,
    unreadCount: activeItems.filter(
      (item) => (item.progress?.completionPercent ?? 0) < 100,
    ).length,
  };
}

function compareLibraryItemsByEngagement(
  left: LibraryCollectionRecord['items'][number]['libraryItem'],
  right: LibraryCollectionRecord['items'][number]['libraryItem'],
) {
  return getLibraryItemTimestamp(right) - getLibraryItemTimestamp(left);
}

function getLibraryItemTimestamp(
  item: LibraryCollectionRecord['items'][number]['libraryItem'],
) {
  return getMostRecentLibraryItemEngagementDate(item).getTime();
}

function getMostRecentLibraryItemEngagementDate(
  item: LibraryCollectionRecord['items'][number]['libraryItem'],
) {
  const lastReadAtMs = item.progress?.lastReadAt?.getTime() ?? 0;
  const lastOpenedAtMs = item.lastOpenedAt?.getTime() ?? 0;
  const addedAtMs = item.addedAt.getTime();

  return new Date(Math.max(lastReadAtMs, lastOpenedAtMs, addedAtMs));
}

function isPrismaUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

function normalizeCollectionDescription(rawDescription: null | string) {
  const trimmed = rawDescription?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
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

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
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../shared/blob-utils';
import { UsersService } from '../users/users.service';
import {
  DEFAULT_SMART_COLLECTIONS,
  getSmartCollectionKey,
} from '../shared/default-collections';
import { resolveUniqueCollectionName } from '../shared/collection-name';
import { syncOfflineBooksMembership } from './offline-collection-membership';
import {
  detectBookFileFormat,
  extractBookMetadata,
  isSupportedSourceFormat,
} from '../shared/metadata-extractor';
import { buildBookSlugBase } from '../shared/book-slug';
import { buildCollectionSlugBase } from '../shared/collection-slug';
import { resolveUniqueSlug } from '../shared/slugify';
import { inferMimeType, normalizeBookLanguage } from '../shared/book-utils';

type TransactionClient = Prisma.TransactionClient;
const LIBRARY_COLLECTION_PREVIEW_LIMIT = 4;

export type LibraryMutationPayload = {
  addedAt: string;
  book: {
    authors: string[];
    format: BookFileFormat;
    id: string;
    title: string;
  };
  libraryItemId: string;
  slug: string;
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
                coverBlob: { select: { mimeType: true } };
                files: {
                  select: { format: true; isPrimary: true; kind: true };
                };
              };
            };
            progress: true;
          };
        };
      };
    };
  };
}>;

type LibraryItemLite = Prisma.LibraryItemGetPayload<{
  select: {
    id: true;
    isArchived: true;
    addedAt: true;
    lastOpenedAt: true;
    progress: {
      select: { completionPercent: true; lastReadAt: true };
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

    // Write the blob bytes outside the metadata transaction. Multi-MB
    // writes can blow past the default interactive-transaction timeout
    // and would also hold a DB connection plus row locks for the whole
    // upload. Blobs are referenced by id, so as long as they exist when
    // the metadata insert runs, relational integrity holds. If the
    // metadata transaction fails, we best-effort delete the blobs we
    // just wrote; anything we miss is an orphan that the periodic GC
    // (OrphanBlobCleanupService) will sweep up.
    const blob = await this.prisma.storedBlob.create({
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
      ? await this.prisma.storedBlob.create({
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

    try {
      return await this.prisma.$transaction(async (tx) => {
        const book = await tx.book.create({
          data: {
            title: metadata.title,
            authors: metadata.authors,
            description: metadata.description,
            genres: metadata.genres,
            language: normalizeBookLanguage(metadata.language),
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
    } catch (error) {
      await this.prisma.storedBlob
        .delete({ where: { id: blob.id } })
        .catch(() => {});
      if (coverBlob) {
        await this.prisma.storedBlob
          .delete({ where: { id: coverBlob.id } })
          .catch(() => {});
      }
      throw error;
    }
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

    // Phase 1: pull collections and a lightweight view of every item — enough
    // to compute counts and the engagement sort, but without any book metadata
    // or cover bytes. Touching cover bytes here is the historical hot path
    // that made library loads slow.
    const collections = await this.prisma.collection.findMany({
      where: { userId: user.id },
      select: {
        description: true,
        id: true,
        kind: true,
        name: true,
        slug: true,
        smartKey: true,
        sortOrder: true,
        items: {
          select: {
            libraryItem: {
              select: {
                addedAt: true,
                id: true,
                isArchived: true,
                lastOpenedAt: true,
                progress: {
                  select: { completionPercent: true, lastReadAt: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const perCollection = collections.map((collection) => {
      const activeItems = collection.items
        .map((item) => item.libraryItem)
        .filter((item) => !item.isArchived)
        .sort(compareLightweightItemsByEngagement);
      const previewIds = activeItems
        .slice(0, LIBRARY_COLLECTION_PREVIEW_LIMIT)
        .map((item) => item.id);
      return { activeItems, collection, previewIds };
    });

    // Phase 2: fetch full book detail for only the preview library items we
    // actually need to render. Cover blob is selected without `bytes` so the
    // response shape stays small — the browser fetches cover images by URL.
    const previewIds = Array.from(
      new Set(perCollection.flatMap(({ previewIds }) => previewIds)),
    );
    const previewItems = previewIds.length
      ? await this.prisma.libraryItem.findMany({
          where: { id: { in: previewIds } },
          select: {
            id: true,
            slug: true,
            offlineRequested: true,
            book: {
              select: {
                authors: true,
                coverBlob: { select: { mimeType: true } },
                files: {
                  select: { format: true, isPrimary: true, kind: true },
                },
                id: true,
                title: true,
              },
            },
          },
        })
      : [];
    const previewById = new Map(previewItems.map((item) => [item.id, item]));

    return {
      collections: perCollection.map(
        ({ activeItems, collection, previewIds }) => {
          const books = previewIds
            .map((id) => {
              const item = previewById.get(id);
              const lite = activeItems.find((candidate) => candidate.id === id);
              if (!item || !lite) {
                return null;
              }
              return serializePreviewBook(item, lite);
            })
            .filter((book): book is NonNullable<typeof book> => book !== null);

          return {
            books,
            description: collection.description,
            id: collection.id,
            itemCount: activeItems.length,
            kind: collection.kind,
            name: collection.name,
            slug: collection.slug,
            smartKey: collection.smartKey,
            unreadCount: activeItems.filter(
              (item) => (item.progress?.completionPercent ?? 0) < 100,
            ).length,
          };
        },
      ),
      summary: {
        booksCount: perCollection.reduce(
          (sum, { activeItems }) => sum + activeItems.length,
          0,
        ),
        collectionsCount: collections.length,
      },
    };
  }

  async getBookCover(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { coverBlob: { select: { bytes: true, mimeType: true } } },
    });
    return book?.coverBlob ?? null;
  }

  async getCollection(clerkUserId: string, collectionId: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);

    const collection = await this.prisma.collection.findFirst({
      where: {
        userId: user.id,
        OR: [{ id: collectionId }, { slug: collectionId }],
      },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                book: {
                  include: {
                    coverBlob: { select: { mimeType: true } },
                    // readingProgressIndex on BookFile is a per-position
                    // progress map (see schema.prisma) — multi-KB per file
                    // and never rendered on this screen. Pick only the
                    // scalars we need.
                    files: {
                      select: { format: true, isPrimary: true, kind: true },
                    },
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

  async getLibraryItem(clerkUserId: string, libraryItemId: string) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);

    const item = await this.prisma.libraryItem.findFirst({
      where: {
        userId: user.id,
        isArchived: false,
        OR: [{ id: libraryItemId }, { slug: libraryItemId }],
      },
      include: {
        book: {
          include: {
            coverBlob: { select: { mimeType: true } },
            // See note in getCollection — files.readingProgressIndex is a
            // multi-KB JSON we never render here.
            files: {
              select: { format: true, isPrimary: true, kind: true },
            },
          },
        },
        collectionItems: {
          include: {
            collection: {
              select: {
                id: true,
                kind: true,
                name: true,
                smartKey: true,
                sortOrder: true,
              },
            },
          },
        },
        progress: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Book not found in library.');
    }

    const primarySource =
      item.book.files.find(
        (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
      ) ??
      item.book.files.find((file) => file.isPrimary) ??
      null;

    const collections = sortAndSerializeCollections(item.collectionItems);

    return {
      book: {
        addedAt: item.addedAt.toISOString(),
        approximateBodyPageCount: item.book.estimatedBodyPageCount ?? null,
        approximatePageCount: item.book.estimatedPageCount ?? null,
        authors: item.book.authors,
        chapterLabel: item.progress?.chapterLabel ?? null,
        collections,
        completionPercent: item.progress?.completionPercent ?? 0,
        coverImageUrl: item.book.coverBlob
          ? buildCoverImageUrl(item.book.id)
          : null,
        description: item.book.description,
        genres: item.book.genres,
        language: item.book.language,
        lastReadAt: item.progress?.lastReadAt?.toISOString() ?? null,
        libraryItemId: item.id,
        minutesRead: item.progress?.minutesRead ?? 0,
        offlineRequested: item.offlineRequested,
        primaryFormat: primarySource?.format ?? BookFileFormat.UNKNOWN,
        publishedYear: item.book.publishedYear,
        slug: item.slug,
        source: item.source,
        title: item.book.title,
      },
    };
  }

  // Sets the per-user "keep this book available offline" intent. Synced across
  // devices: a new device reads this on its next library load and the cache
  // primer downloads the content (see specs/12-offline-save-sync). Idempotent;
  // accepts either a libraryItemId or a slug like the read endpoints.
  async setOfflineRequested(
    clerkUserId: string,
    libraryItemId: string,
    requested: boolean,
  ) {
    const user = await this.usersService.getCurrentUserRecord(clerkUserId);
    const item = await this.prisma.libraryItem.findFirst({
      where: {
        userId: user.id,
        isArchived: false,
        OR: [{ id: libraryItemId }, { slug: libraryItemId }],
      },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Book not found in library.');
    }
    // The flag and the Offline Books membership it drives move together, so a
    // partial write can't leave the shelf disagreeing with the flag.
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.libraryItem.update({
        where: { id: item.id },
        data: { offlineRequested: requested },
        select: { id: true, slug: true, offlineRequested: true },
      });
      await syncOfflineBooksMembership(tx, {
        libraryItemId: row.id,
        requested,
        userId: user.id,
      });
      return row;
    });
    return {
      libraryItemId: updated.id,
      offlineRequested: updated.offlineRequested,
      slug: updated.slug,
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
        kind: true,
      },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found.');
    }

    if (collection.kind === 'SMART') {
      throw new ForbiddenException('Smart collections cannot be renamed.');
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
    const collection = await this.prisma.collection.findFirst({
      where: {
        id: collectionId,
        userId: user.id,
      },
      select: { id: true, kind: true },
    });

    if (!collection) {
      throw new NotFoundException('Collection not found.');
    }

    // System-owned shelves are recreated on the next import, so deleting one
    // only makes it flicker out and back. Blocked here as well as in the UI.
    if (collection.kind === 'SMART') {
      throw new ForbiddenException('Smart collections cannot be deleted.');
    }

    await this.prisma.collection.delete({ where: { id: collection.id } });

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
      (await (async () => {
        const book = await tx.book.findUniqueOrThrow({
          where: { id: input.bookId },
          select: { title: true, authors: true },
        });
        const baseSlug = buildBookSlugBase({
          title: book.title,
          authors: book.authors,
        });
        const slug = await resolveUniqueSlug(baseSlug, async (candidate) => {
          const conflict = await tx.libraryItem.findUnique({
            where: {
              userId_slug: { userId: input.userId, slug: candidate },
            },
            select: { id: true },
          });
          return conflict !== null;
        });

        return tx.libraryItem.create({
          data: {
            userId: input.userId,
            bookId: input.bookId,
            slug,
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
        });
      })());

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
        authors: libraryItem.book.authors,
        format: primaryFile?.format ?? BookFileFormat.UNKNOWN,
        id: libraryItem.book.id,
        title: libraryItem.book.title,
      },
      libraryItemId: libraryItem.id,
      slug: libraryItem.slug,
      source: input.source,
      state: existing ? 'existing' : 'added',
    };
  }

  private async ensureDefaultCollectionsTx(
    tx: TransactionClient,
    userId: string,
  ) {
    for (const collection of DEFAULT_SMART_COLLECTIONS) {
      const baseSlug = buildCollectionSlugBase({ name: collection.name });
      const slug = await resolveUniqueSlug(baseSlug, async (candidate) => {
        const conflict = await tx.collection.findUnique({
          where: { userId_slug: { userId, slug: candidate } },
          select: { id: true, smartKey: true },
        });
        return conflict !== null && conflict.smartKey !== collection.smartKey;
      });
      const name = await resolveUniqueCollectionName(
        collection.name,
        async (candidate) => {
          const conflict = await tx.collection.findUnique({
            where: { userId_name: { userId, name: candidate } },
            select: { smartKey: true },
          });
          return conflict !== null && conflict.smartKey !== collection.smartKey;
        },
      );

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
          name,
          sortOrder: collection.sortOrder,
        },
        create: {
          userId,
          smartKey: collection.smartKey,
          description: collection.description,
          kind: 'SMART',
          name,
          slug,
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

function serializeCollection(collection: LibraryCollectionRecord) {
  const activeItems = collection.items
    .map((item) => item.libraryItem)
    .filter((item) => !item.isArchived)
    .sort(compareLibraryItemsByEngagement);
  const books = activeItems.map((item) => {
    const primarySource =
      item.book.files.find(
        (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
      ) ??
      item.book.files.find((file) => file.isPrimary) ??
      null;

    return {
      authors: item.book.authors,
      completionPercent: item.progress?.completionPercent ?? 0,
      coverImageUrl: item.book.coverBlob
        ? buildCoverImageUrl(item.book.id)
        : null,
      lastReadAt: getMostRecentLibraryItemEngagementDate(item).toISOString(),
      libraryItemId: item.id,
      offlineRequested: item.offlineRequested,
      primaryFormat: primarySource?.format ?? BookFileFormat.UNKNOWN,
      slug: item.slug,
      title: item.book.title,
    };
  });

  return {
    books,
    description: collection.description,
    id: collection.id,
    itemCount: activeItems.length,
    kind: collection.kind,
    name: collection.name,
    slug: collection.slug,
    smartKey: collection.smartKey,
    unreadCount: activeItems.filter(
      (item) => (item.progress?.completionPercent ?? 0) < 100,
    ).length,
  };
}

type LibraryPreviewBookRecord = Prisma.LibraryItemGetPayload<{
  select: {
    id: true;
    slug: true;
    offlineRequested: true;
    book: {
      select: {
        authors: true;
        coverBlob: { select: { mimeType: true } };
        files: { select: { format: true; isPrimary: true; kind: true } };
        id: true;
        title: true;
      };
    };
  };
}>;

function serializePreviewBook(
  item: LibraryPreviewBookRecord,
  lite: LibraryItemLite,
) {
  const primarySource =
    item.book.files.find(
      (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
    ) ??
    item.book.files.find((file) => file.isPrimary) ??
    null;

  return {
    authors: item.book.authors,
    completionPercent: lite.progress?.completionPercent ?? 0,
    coverImageUrl: item.book.coverBlob
      ? buildCoverImageUrl(item.book.id)
      : null,
    lastReadAt: getEngagementDateFromLite(lite).toISOString(),
    libraryItemId: item.id,
    offlineRequested: item.offlineRequested,
    primaryFormat: primarySource?.format ?? BookFileFormat.UNKNOWN,
    slug: item.slug,
    title: item.book.title,
  };
}

function buildCoverImageUrl(bookId: string) {
  // The Nest app mounts under a global `/api` prefix (see app.config.ts), so
  // the public-facing URL must include it.
  return `/api/library/covers/${bookId}`;
}

type CollectionItemForSerialize = {
  collection: {
    id: string;
    kind: 'SMART' | 'CUSTOM';
    name: string;
    smartKey: null | string;
    sortOrder: number;
  };
};

function sortAndSerializeCollections(
  collectionItems: CollectionItemForSerialize[],
) {
  return collectionItems
    .map((collectionItem) => collectionItem.collection)
    .sort((left, right) => {
      if (left.sortOrder === right.sortOrder) {
        return left.name.localeCompare(right.name);
      }
      return left.sortOrder - right.sortOrder;
    })
    .map((collection) => ({
      id: collection.id,
      kind: collection.kind,
      name: collection.name,
      smartKey: collection.smartKey,
    }));
}

function compareLightweightItemsByEngagement(
  left: LibraryItemLite,
  right: LibraryItemLite,
) {
  return (
    getEngagementDateFromLite(right).getTime() -
    getEngagementDateFromLite(left).getTime()
  );
}

function getEngagementDateFromLite(item: LibraryItemLite) {
  const lastReadAtMs = item.progress?.lastReadAt?.getTime() ?? 0;
  const lastOpenedAtMs = item.lastOpenedAt?.getTime() ?? 0;
  const addedAtMs = item.addedAt.getTime();
  return new Date(Math.max(lastReadAtMs, lastOpenedAtMs, addedAtMs));
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

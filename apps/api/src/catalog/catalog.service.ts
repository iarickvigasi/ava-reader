import {
  BlobPurpose,
  BookFileFormat,
  BookFileKind,
  CatalogStatus,
  Prisma,
  ProcessingStatus,
} from '@prisma/client';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LibraryService } from '../library/library.service';
import {
  bufferToDataUrl,
  checksumBuffer,
  toPrismaBytes,
} from '../shared/blob-utils';
import {
  parseBooleanInput,
  parseOptionalNumberInput,
  parseOptionalStringInput,
} from '../shared/form-utils';
import {
  detectBookFileFormat,
  extractBookMetadata,
  isSupportedSourceFormat,
} from '../shared/metadata-extractor';

type CatalogFormInput = Record<string, unknown>;
type CatalogFilesInput = {
  coverImage?: Express.Multer.File[];
  sourceFile?: Express.Multer.File[];
};

type CatalogEntryRecord = Prisma.CatalogEntryGetPayload<{
  include: {
    book: {
      include: {
        coverBlob: true;
        files: true;
      };
    };
  };
}>;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly libraryService: LibraryService,
  ) {}

  async listAdminCatalog(clerkUserId: string) {
    await this.usersService.assertAdmin(clerkUserId);

    const entries = await this.prisma.catalogEntry.findMany({
      include: {
        book: {
          include: {
            coverBlob: true,
            files: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });

    return entries.map((entry) => this.serializeCatalogEntry(entry));
  }

  async createCatalogEntry(
    clerkUserId: string,
    body: CatalogFormInput,
    files: CatalogFilesInput,
  ) {
    const admin = await this.usersService.assertAdmin(clerkUserId);
    const sourceFile = files.sourceFile?.[0];

    if (!sourceFile) {
      throw new BadRequestException('A source EPUB or PDF is required.');
    }

    const format = detectBookFileFormat(sourceFile);

    if (!isSupportedSourceFormat(format)) {
      throw new BadRequestException(
        'Catalog books must use EPUB or PDF files.',
      );
    }

    const metadata = await extractBookMetadata(sourceFile);
    const coverImage = files.coverImage?.[0];

    const entry = await this.prisma.$transaction(async (tx) => {
      const sourceBlob = await tx.storedBlob.create({
        data: {
          purpose: BlobPurpose.BOOK_SOURCE,
          mimeType: sourceFile.mimetype || inferMimeType(format),
          sizeBytes: sourceFile.size,
          originalFilename: sourceFile.originalname,
          checksum: checksumBuffer(sourceFile.buffer),
          bytes: toPrismaBytes(sourceFile.buffer),
        },
      });

      const coverBlob = coverImage
        ? await tx.storedBlob.create({
            data: {
              purpose: BlobPurpose.BOOK_COVER,
              mimeType: coverImage.mimetype || 'image/*',
              sizeBytes: coverImage.size,
              originalFilename: coverImage.originalname,
              checksum: checksumBuffer(coverImage.buffer),
              bytes: toPrismaBytes(coverImage.buffer),
            },
          })
        : null;

      return tx.catalogEntry.create({
        data: {
          status: parseCatalogStatus(body.status),
          editorialTitle: parseOptionalStringInput(body.editorialTitle),
          editorialDescription: parseOptionalStringInput(
            body.editorialDescription,
          ),
          curatorNote: parseOptionalStringInput(body.curatorNote),
          isFeatured: parseBooleanInput(body.isFeatured, false),
          featuredRank: parseOptionalNumberInput(body.featuredRank),
          sortOrder: parseOptionalNumberInput(body.sortOrder) ?? 0,
          createdByUser: {
            connect: {
              id: admin.id,
            },
          },
          book: {
            create: {
              title: parseOptionalStringInput(body.title) ?? metadata.title,
              author: parseOptionalStringInput(body.author) ?? metadata.author,
              description:
                parseOptionalStringInput(body.description) ??
                metadata.description,
              language: normalizeBookLanguage(
                parseOptionalStringInput(body.language) ?? metadata.language,
              ),
              publishedYear:
                parseOptionalNumberInput(body.publishedYear) ??
                metadata.publishedYear ??
                undefined,
              coverBlobId: coverBlob?.id,
              files: {
                create: {
                  blobId: sourceBlob.id,
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
          },
        },
        include: {
          book: {
            include: {
              coverBlob: true,
              files: true,
            },
          },
        },
      });
    });

    return this.serializeCatalogEntry(entry);
  }

  async updateCatalogEntry(
    clerkUserId: string,
    entryId: string,
    body: CatalogFormInput,
    files: CatalogFilesInput,
  ) {
    await this.usersService.assertAdmin(clerkUserId);

    const currentEntry = await this.prisma.catalogEntry.findUnique({
      where: { id: entryId },
      include: {
        book: {
          include: {
            files: true,
          },
        },
      },
    });

    if (!currentEntry) {
      throw new BadRequestException(
        'The requested catalog entry was not found.',
      );
    }

    const sourceFile = files.sourceFile?.[0];
    const coverImage = files.coverImage?.[0];
    const format = sourceFile ? detectBookFileFormat(sourceFile) : null;

    if (sourceFile && !isSupportedSourceFormat(format)) {
      throw new BadRequestException(
        'Catalog books must use EPUB or PDF files.',
      );
    }

    const metadata = sourceFile ? await extractBookMetadata(sourceFile) : null;

    const entry = await this.prisma.$transaction(async (tx) => {
      let coverBlobId = currentEntry.book.coverBlobId;

      if (coverImage) {
        const coverBlob = await tx.storedBlob.create({
          data: {
            purpose: BlobPurpose.BOOK_COVER,
            mimeType: coverImage.mimetype || 'image/*',
            sizeBytes: coverImage.size,
            originalFilename: coverImage.originalname,
            checksum: checksumBuffer(coverImage.buffer),
            bytes: toPrismaBytes(coverImage.buffer),
          },
        });

        coverBlobId = coverBlob.id;
      }

      if (sourceFile && format) {
        const sourceBlob = await tx.storedBlob.create({
          data: {
            purpose: BlobPurpose.BOOK_SOURCE,
            mimeType: sourceFile.mimetype || inferMimeType(format),
            sizeBytes: sourceFile.size,
            originalFilename: sourceFile.originalname,
            checksum: checksumBuffer(sourceFile.buffer),
            bytes: toPrismaBytes(sourceFile.buffer),
          },
        });

        await tx.bookFile.updateMany({
          where: {
            bookId: currentEntry.bookId,
            kind: BookFileKind.SOURCE,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });

        await tx.bookFile.create({
          data: {
            bookId: currentEntry.bookId,
            blobId: sourceBlob.id,
            format,
            kind: BookFileKind.SOURCE,
            processingStatus: ProcessingStatus.READY,
            isPrimary: true,
          },
        });

        if (format === BookFileFormat.EPUB) {
          await tx.bookProcessingRun.create({
            data: {
              bookId: currentEntry.bookId,
              pipeline: 'normalize-reader-package-v1',
              status: ProcessingStatus.PENDING,
            },
          });
        }
      }

      const status =
        typeof body.status === 'string'
          ? parseCatalogStatus(body.status)
          : currentEntry.status;
      const hasSourceFile =
        sourceFile ||
        currentEntry.book.files.some(
          (file) => file.kind === BookFileKind.SOURCE,
        );

      if (status === CatalogStatus.PUBLISHED && !hasSourceFile) {
        throw new BadRequestException(
          'Published catalog books must include a source file.',
        );
      }

      return tx.catalogEntry.update({
        where: { id: entryId },
        data: {
          status,
          editorialTitle: normalizeNullableValue(body.editorialTitle),
          editorialDescription: normalizeNullableValue(
            body.editorialDescription,
          ),
          curatorNote: normalizeNullableValue(body.curatorNote),
          isFeatured: parseBooleanInput(
            body.isFeatured,
            currentEntry.isFeatured,
          ),
          featuredRank:
            parseOptionalNumberInput(body.featuredRank) ??
            currentEntry.featuredRank,
          sortOrder:
            parseOptionalNumberInput(body.sortOrder) ?? currentEntry.sortOrder,
          book: {
            update: {
              title:
                parseOptionalStringInput(body.title) ??
                metadata?.title ??
                currentEntry.book.title,
              author:
                parseOptionalStringInput(body.author) ??
                metadata?.author ??
                currentEntry.book.author,
              description:
                parseOptionalStringInput(body.description) ??
                metadata?.description ??
                currentEntry.book.description,
              language: normalizeBookLanguage(
                parseOptionalStringInput(body.language) ??
                  metadata?.language ??
                  currentEntry.book.language,
              ),
              publishedYear:
                parseOptionalNumberInput(body.publishedYear) ??
                metadata?.publishedYear ??
                currentEntry.book.publishedYear ??
                undefined,
              coverBlobId,
            },
          },
        },
        include: {
          book: {
            include: {
              coverBlob: true,
              files: true,
            },
          },
        },
      });
    });

    return this.serializeCatalogEntry(entry);
  }

  addCatalogBookToLibrary(clerkUserId: string, entryId: string) {
    return this.libraryService.addCatalogBookToLibrary(clerkUserId, entryId);
  }

  private serializeCatalogEntry(entry: CatalogEntryRecord) {
    const sourceFile = entry.book.files.find(
      (file) => file.kind === BookFileKind.SOURCE && file.isPrimary,
    );

    return {
      book: {
        author: entry.book.author,
        coverImageDataUrl: entry.book.coverBlob
          ? bufferToDataUrl(
              entry.book.coverBlob.bytes,
              entry.book.coverBlob.mimeType,
            )
          : null,
        description: entry.book.description,
        hasSourceFile: Boolean(sourceFile),
        id: entry.book.id,
        primaryFormat: sourceFile?.format ?? BookFileFormat.UNKNOWN,
        title: entry.book.title,
      },
      createdAt: entry.createdAt.toISOString(),
      curatorNote: entry.curatorNote,
      editorialDescription: entry.editorialDescription,
      editorialTitle: entry.editorialTitle,
      featuredRank: entry.featuredRank,
      id: entry.id,
      isFeatured: entry.isFeatured,
      sortOrder: entry.sortOrder,
      status: entry.status,
      updatedAt: entry.updatedAt.toISOString(),
    };
  }
}

function parseCatalogStatus(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return CatalogStatus.DRAFT;
  }

  const normalized = value.trim().toUpperCase();

  if (normalized === CatalogStatus.PUBLISHED) {
    return CatalogStatus.PUBLISHED;
  }

  if (normalized === CatalogStatus.ARCHIVED) {
    return CatalogStatus.ARCHIVED;
  }

  return CatalogStatus.DRAFT;
}

function normalizeNullableValue(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

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

function normalizeBookLanguage(
  value: null | string | undefined,
): null | string {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  try {
    return new Intl.Locale(trimmed.replace(/_/g, '-')).toString();
  } catch {
    return trimmed;
  }
}

import type { PrismaService } from '../../prisma/prisma.service';
import {
  BookVisibility,
  BookFileFormat,
  BookFileKind,
  ProcessingStatus,
  type Prisma,
} from '@prisma/client';
import {
  storeBookBlobs,
  deleteBookBlobsBestEffort,
} from '../../library/import/store-book-blobs';
import { prepareImport } from './prepare-import';
import { importKey } from './import-key';
import type { ImportManifest } from './manifest';
import { storeImportSnapshot } from '../publication/store-import-snapshot';

export async function createImport(
  prisma: PrismaService,
  adminId: string | null,
  manifest: ImportManifest,
  file: Express.Multer.File,
) {
  const key = importKey(manifest.editionId, manifest.checksum);
  const metadata = await prepareImport(manifest, file);
  const metadataBlobId = await storeImportSnapshot(manifest);
  const { blob: source, coverBlob } = await storeBookBlobs({
    publicCopy: true,
    prisma,
    format: BookFileFormat.EPUB,
    coverImage: metadata.coverImage,
    file: {
      ...file,
      size: file.buffer.length,
      originalname: manifest.filename,
      mimetype: 'application/epub+zip',
    },
  });
  try {
    return await prisma.catalogEntry.create({
      data: {
        importKey: key,
        importEvidence: {
          ...manifest,
          metadata: {},
          fileMetadata: {},
          metadataBlobId,
        } as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        createdByUser: adminId ? { connect: { id: adminId } } : undefined,
        curatorNote: adminId ? undefined : 'Imported by server operator',
        book: {
          create: {
            visibility: BookVisibility.PUBLIC,
            title: manifest.title,
            authors: manifest.authors,
            language: manifest.language,
            description: metadata.description,
            genres: metadata.genres,
            publishedYear: metadata.publishedYear,
            coverBlobId: coverBlob?.id,
            files: {
              create: {
                blobId: source.id,
                format: BookFileFormat.EPUB,
                kind: BookFileKind.SOURCE,
                isPrimary: true,
                processingStatus: ProcessingStatus.READY,
              },
            },
            processingRuns: {
              create: {
                pipeline: 'normalize-reader-package-v1',
                status: ProcessingStatus.PENDING,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    await deleteBookBlobsBestEffort(prisma, [
      source.id,
      ...(coverBlob ? [coverBlob.id] : []),
    ]);
    throw error;
  }
}

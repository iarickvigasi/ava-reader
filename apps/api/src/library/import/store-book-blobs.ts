import { BlobPurpose } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../../shared/blob-utils';
import { inferMimeType } from '../../shared/book-utils';
import type { ExtractedBookMetadata } from '../../shared/metadata-extractor';
import { storeBookBlob } from '../../catalog/publication/store-book-blob';

// Stores the uploaded source file and its extracted cover as blobs, ahead of
// the metadata transaction (see import-book.ts for why the order matters).
export async function storeBookBlobs(options: {
  coverImage: ExtractedBookMetadata['coverImage'];
  file: Express.Multer.File;
  format: 'EPUB' | 'PDF';
  prisma: PrismaService;
  publicCopy?: boolean;
}) {
  const blob = await storeBookBlob(
    options.prisma,
    options.publicCopy ?? false,
    {
      data: {
        purpose: BlobPurpose.BOOK_SOURCE,
        mimeType: options.file.mimetype || inferMimeType(options.format),
        sizeBytes: options.file.size,
        originalFilename: options.file.originalname,
        checksum: checksumBuffer(options.file.buffer),
        bytes: toPrismaBytes(options.file.buffer),
      },
    },
  );

  const coverBlob = options.coverImage
    ? await storeBookBlob(options.prisma, options.publicCopy ?? false, {
        data: {
          purpose: BlobPurpose.BOOK_COVER,
          mimeType: options.coverImage.mimeType,
          sizeBytes: options.coverImage.bytes.byteLength,
          originalFilename: options.coverImage.originalFilename,
          checksum: checksumBuffer(options.coverImage.bytes),
          bytes: toPrismaBytes(options.coverImage.bytes),
        },
      })
    : null;

  return { blob, coverBlob };
}

// If the metadata transaction fails, we best-effort delete the blobs we just
// wrote; anything we miss is an orphan that the periodic GC
// (OrphanBlobCleanupService) will sweep up.
export async function deleteBookBlobsBestEffort(
  prisma: PrismaService,
  blobIds: string[],
) {
  for (const blobId of blobIds) {
    await prisma.storedBlob.delete({ where: { id: blobId } }).catch(() => {});
  }
}

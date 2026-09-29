import {
  BlobPurpose,
  Prisma,
  type BookFile,
  type PrismaClient,
} from '@prisma/client';
import { checksumBuffer, toPrismaBytes } from '../../shared/blob-utils';
import type { ReaderPackage } from '../../reader/reader-types';

export async function savePackage(
  prisma: PrismaClient,
  file: BookFile,
  readerPackage: ReaderPackage,
  index: Prisma.InputJsonValue | null,
) {
  const bytes = Buffer.from(JSON.stringify(readerPackage));
  const blob = await prisma.storedBlob.create({
    data: {
      bytes: toPrismaBytes(bytes),
      checksum: checksumBuffer(bytes),
      mimeType: 'application/vnd.ava.reader-package+json',
      originalFilename: `${file.bookId}-reader-package.json`,
      purpose: BlobPurpose.DERIVED_READER,
      sizeBytes: bytes.byteLength,
    },
    select: { id: true },
  });
  // The old blob remains referenced by a non-primary backup file, safe from GC.
  // Keep the primary file ID: analysis and translations still refer to the same content.
  return prisma.$transaction(async (tx) => {
    const updated = await tx.bookFile.updateMany({
      where: {
        id: file.id,
        blobId: file.blobId,
        updatedAt: file.updatedAt,
        isPrimary: true,
      },
      data: { blobId: blob.id, readingProgressIndex: index ?? Prisma.DbNull },
    });
    if (updated.count !== 1)
      throw new Error('Reader file changed concurrently; rerun');
    const backup = await tx.bookFile.create({
      data: {
        bookId: file.bookId,
        blobId: file.blobId,
        kind: file.kind,
        format: file.format,
        processingStatus: file.processingStatus,
        isPrimary: false,
        readingProgressIndex: file.readingProgressIndex ?? Prisma.DbNull,
      },
      select: { id: true },
    });
    return {
      backupFileId: backup.id,
      oldBlobId: file.blobId,
      newBlobId: blob.id,
    };
  });
  // A failed swap leaves an unreferenced new blob for the existing orphan sweeper.
}

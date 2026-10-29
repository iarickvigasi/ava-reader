import type { PrismaService } from '../prisma/prisma.service';
import { checksumBuffer, toPrismaBytes } from '../shared/blob-utils';
import { storeBookBlob } from '../catalog/publication/store-book-blob';

export function storeReaderOutput(
  prisma: PrismaService,
  book: { id: string; visibility: string },
  bytes: Buffer,
) {
  return storeBookBlob(prisma, book.visibility === 'PUBLIC', {
    data: {
      bytes: toPrismaBytes(bytes),
      checksum: checksumBuffer(bytes),
      mimeType: 'application/vnd.ava.reader-package+json',
      originalFilename: `${book.id}-reader-package.json`,
      purpose: 'DERIVED_READER',
      sizeBytes: bytes.length,
    },
  });
}

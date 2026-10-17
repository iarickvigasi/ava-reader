import type { PrismaService } from '../../prisma/prisma.service';
import { checksumBuffer } from '../../shared/blob-utils';
export function coverFixture() {
  const bytes = Buffer.from('authored-cover-bytes'),
    sha256 = checksumBuffer(bytes);
  const blob = {
    bytes,
    mimeType: 'image/png',
    checksum: sha256,
    sizeBytes: bytes.length,
  };
  const item = {
    bookId: 'book',
    book: { canonicalImportPrivate: true, coverBlobId: 'cover' },
  };
  const mock = {
    libraryItem: { findFirst: jest.fn().mockResolvedValue(item) },
    canonicalEpubImport: {
      findFirst: jest.fn().mockResolvedValue({ id: 'import' }),
    },
    canonicalEpubResource: {
      findFirst: jest.fn().mockResolvedValue({
        blob,
        sha256,
        byteLength: bytes.length,
        mediaType: 'image/png',
      }),
    },
  };
  return { prisma: mock as unknown as PrismaService, mock, blob };
}

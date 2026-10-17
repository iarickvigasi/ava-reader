import type { PrismaService } from '../../../prisma/prisma.service';
import { checksumBuffer } from '../../../shared/blob-utils';
import { getPdfCover } from './get-cover';

function fixture(changed = false) {
  const bytes = Buffer.from('validated image');
  const checksum = checksumBuffer(bytes);
  const findFirst = jest.fn().mockResolvedValue({
    role: 'RESOURCE',
    mimeType: 'image/png',
    sizeBytes: bytes.length,
    checksum,
    blob: {
      bytes: changed ? Buffer.from('altered') : bytes,
      mimeType: 'image/png',
      sizeBytes: bytes.length,
      checksum,
    },
  });
  const db = {
    pdfImportOperation: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ libraryItemId: 'item', bookId: 'book' }),
    },
    libraryItem: { findFirst: jest.fn().mockResolvedValue({ id: 'item' }) },
    book: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ coverBlobId: 'cover-blob' }),
    },
    pdfArtifact: { findFirst },
  };
  return { db, findFirst, prisma: db as unknown as PrismaService };
}
it('serves the bound cover resource only within current ownership and accepted retention', async () => {
  const f = fixture();
  const blob = await getPdfCover(f.prisma, 'owner', 'op');
  expect(blob.bytes).toEqual(Buffer.from('validated image'));
  expect(f.findFirst).toHaveBeenCalledWith({
    where: {
      operationId: 'op',
      ownerId: 'owner',
      OR: [{ role: 'COVER' }, { role: 'RESOURCE', retention: 'ACCEPTED' }],
      blobId: 'cover-blob',
      mimeType: { in: ['image/png', 'image/jpeg'] },
    },
    include: { blob: true },
  });
  expect(f.db.libraryItem.findFirst).toHaveBeenCalledTimes(2);
});
it('refuses modified accepted cover bytes', async () => {
  const f = fixture(true);
  await expect(getPdfCover(f.prisma, 'owner', 'op')).rejects.toThrow(
    'Cover not found.',
  );
});

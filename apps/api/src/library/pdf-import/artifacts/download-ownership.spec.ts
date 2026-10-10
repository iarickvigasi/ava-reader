import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../../prisma/prisma.service';
import { getPdfArtifact } from './get-artifact';
import { getPdfCover } from './get-cover';
import { getPublishedPdfEpub } from './get-epub';

type Removal = 'operation' | 'membership' | null;
const downloads = [
  ['PDF', (db: PrismaService) => getPdfArtifact(db, 'owner', 'op', 'source')],
  ['cover', (db: PrismaService) => getPdfCover(db, 'owner', 'op')],
  ['EPUB', (db: PrismaService) => getPublishedPdfEpub(db, 'owner', 'op')],
] as const;
function fixture(removal: Removal) {
  let fetched = false;
  const bytes = Buffer.from('owned fixture bytes');
  const blob = {
    bytes,
    checksum: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.length,
    mimeType: 'application/epub+zip',
  };
  const artifact = {
    ...blob,
    id: 'source',
    blob,
  };
  const operation = {
    id: 'op',
    libraryItemId: 'item',
    bookId: 'book',
    sourceArtifactId: 'source',
    status: 'READY',
    finalContentId: 'final',
  };
  const db = {
    pdfImportOperation: {
      findFirst: jest.fn(() =>
        Promise.resolve(fetched && removal === 'operation' ? null : operation),
      ),
    },
    libraryItem: {
      findFirst: jest.fn(() =>
        Promise.resolve(
          fetched && removal === 'membership' ? null : { id: 'item' },
        ),
      ),
    },
    book: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ coverBlobId: 'cover' }),
    },
    pdfPublication: {
      findUnique: jest.fn().mockResolvedValue({
        finalContentId: 'final',
        epubArtifactId: 'source',
      }),
    },
    pdfArtifact: {
      findFirst: jest.fn(() => {
        fetched = true;
        return Promise.resolve(artifact);
      }),
    },
  };
  return { db, blob, prisma: db as unknown as PrismaService };
}

describe.each(downloads)('%s download ownership', (_name, download) => {
  it('returns the same bytes after a fresh ownership check', async () => {
    const { db, blob, prisma } = fixture(null);
    await expect(download(prisma)).resolves.toBe(blob);
    expect(db.pdfImportOperation.findFirst).toHaveBeenCalledTimes(2);
    expect(db.libraryItem.findFirst).toHaveBeenCalledTimes(2);
  });
  it.each(['operation', 'membership'] as const)(
    'refuses bytes when %s disappears during the blob fetch',
    async (removal) => {
      const { db, prisma } = fixture(removal);
      await expect(download(prisma)).rejects.toBeInstanceOf(NotFoundException);
      expect(db.pdfArtifact.findFirst).toHaveBeenCalledTimes(1);
      expect(db.pdfImportOperation.findFirst).toHaveBeenCalledTimes(2);
    },
  );
});

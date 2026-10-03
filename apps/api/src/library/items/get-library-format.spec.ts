import { createHash } from 'node:crypto';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { BlobPurpose, type StoredBlob } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { getPdfArtifact } from '../pdf-import/artifacts/get-artifact';
import { getPublishedPdfEpub } from '../pdf-import/artifacts/get-epub';
import { getLibraryFormat } from './get-library-format';

jest.mock('../pdf-import/artifacts/get-artifact');
jest.mock('../pdf-import/artifacts/get-epub');

function fixture() {
  const bytes = Buffer.from('original owned EPUB bytes');
  const blob: StoredBlob = {
    id: 'blob',
    createdAt: new Date('2026-10-03T00:00:00Z'),
    updatedAt: new Date('2026-10-03T00:00:00Z'),
    purpose: BlobPurpose.BOOK_SOURCE,
    bytes,
    checksum: createHash('sha256').update(bytes).digest('hex'),
    sizeBytes: bytes.length,
    mimeType: 'application/epub+zip',
    originalFilename: 'original.epub',
  };
  const item = {
    id: 'item',
    bookId: 'book',
    book: {
      pdfImportPrivate: false,
      pdfImport: null as null | { id: string; sourceArtifactId: string },
    },
  };
  const db = {
    libraryItem: { findFirst: jest.fn().mockResolvedValue(item) },
    bookFile: { findMany: jest.fn().mockResolvedValue([{ blob }]) },
  };
  return { db, blob, item, prisma: db as unknown as PrismaService };
}

beforeEach(() => jest.clearAllMocks());

it('downloads exact original EPUB bytes with fresh owned membership before and after fetching', async () => {
  const { db, blob, prisma } = fixture();
  await expect(getLibraryFormat(prisma, 'owner', 'slug', 'epub')).resolves.toBe(
    blob,
  );
  expect(db.libraryItem.findFirst).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      where: {
        userId: 'owner',
        isArchived: false,
        OR: [{ id: 'slug' }, { slug: 'slug' }],
      },
    }),
  );
  expect(db.bookFile.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        bookId: 'book',
        kind: 'SOURCE',
        isPrimary: true,
        format: 'EPUB',
      },
    }),
  );
  expect(db.libraryItem.findFirst).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      where: {
        id: 'item',
        userId: 'owner',
        bookId: 'book',
        isArchived: false,
      },
    }),
  );
});

it('does not fetch bytes for another owner or an archived/missing item', async () => {
  const { db, prisma } = fixture();
  db.libraryItem.findFirst.mockResolvedValue(null);
  await expect(
    getLibraryFormat(prisma, 'foreign', 'item', 'epub'),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(db.bookFile.findMany).not.toHaveBeenCalled();
});

it('rejects removal or archive during the blob fetch', async () => {
  const { db, item, prisma } = fixture();
  db.libraryItem.findFirst
    .mockResolvedValueOnce(item)
    .mockResolvedValueOnce(null);
  await expect(
    getLibraryFormat(prisma, 'owner', 'item', 'epub'),
  ).rejects.toBeInstanceOf(NotFoundException);
});

it.each(['canonical_json', 'reader_package', 'report_json', 'EPUB', 'image'])(
  'never exposes internal or unrecognized %s bytes',
  async (format) => {
    const { db, prisma } = fixture();
    await expect(
      getLibraryFormat(prisma, 'owner', 'item', format),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.libraryItem.findFirst).not.toHaveBeenCalled();
  },
);

it.each([0, 2])(
  'refuses missing or ambiguous source files (%s)',
  async (count) => {
    const { db, blob, prisma } = fixture();
    db.bookFile.findMany.mockResolvedValue(
      Array.from({ length: count }, () => ({ blob })),
    );
    await expect(
      getLibraryFormat(prisma, 'owner', 'item', 'epub'),
    ).rejects.toBeInstanceOf(NotFoundException);
  },
);

it.each(['checksum', 'size', 'mime'])(
  'refuses a source with invalid %s',
  async (fault) => {
    const { blob, prisma } = fixture();
    if (fault === 'checksum') blob.checksum = 'bad';
    if (fault === 'size') blob.sizeBytes++;
    if (fault === 'mime') blob.mimeType = 'text/html';
    await expect(
      getLibraryFormat(prisma, 'owner', 'item', 'epub'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  },
);

it.each(['pdf', 'epub'])(
  'delegates converted %s to existing accepted-publication rules without a source fallback',
  async (format) => {
    const { db, item, blob, prisma } = fixture();
    item.book.pdfImportPrivate = true;
    item.book.pdfImport = { id: 'op', sourceArtifactId: 'source' };
    const lookup =
      format === 'epub'
        ? jest.mocked(getPublishedPdfEpub)
        : jest.mocked(getPdfArtifact);
    lookup.mockResolvedValue(blob);
    await expect(
      getLibraryFormat(prisma, 'owner', 'item', format),
    ).resolves.toBe(blob);
    expect(lookup.mock.calls[0]).toEqual(
      format === 'epub'
        ? [prisma, 'owner', 'op']
        : [prisma, 'owner', 'op', 'source'],
    );
    expect(db.bookFile.findMany).not.toHaveBeenCalled();
    lookup.mockRejectedValueOnce(new NotFoundException('Not published'));
    await expect(
      getLibraryFormat(prisma, 'owner', 'item', format),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.bookFile.findMany).not.toHaveBeenCalled();
  },
);

it('does not bypass a missing PDF import authority', async () => {
  const { db, item, prisma } = fixture();
  item.book.pdfImportPrivate = true;
  await expect(
    getLibraryFormat(prisma, 'owner', 'item', 'pdf'),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(db.bookFile.findMany).not.toHaveBeenCalled();
});

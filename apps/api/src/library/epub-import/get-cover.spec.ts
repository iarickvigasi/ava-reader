import { NotFoundException } from '@nestjs/common';
import { getImportedEpubCover } from './get-cover';
import { coverFixture } from './cover-fixture';
it('returns only a validated owned resource pinned to the current book cover', async () => {
  const { prisma, mock, blob } = coverFixture();
  expect(await getImportedEpubCover(prisma, 'owner', 'library')).toBe(blob);
  expect(mock.libraryItem.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'library', userId: 'owner' } }),
  );
  expect(mock.canonicalEpubImport.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { ownerId: 'owner', libraryItemId: 'library', bookId: 'book' },
    }),
  );
  expect(mock.canonicalEpubResource.findFirst).toHaveBeenCalledWith({
    where: { importId: 'import', blobId: 'cover' },
    include: { blob: true },
  });
  expect(mock.libraryItem.findFirst).toHaveBeenCalledTimes(2);
});
it.each(['foreign owner', 'deleted item'])(
  'refuses %s before reading bytes',
  async () => {
    const { prisma, mock } = coverFixture();
    mock.libraryItem.findFirst.mockResolvedValue(null);
    await expect(
      getImportedEpubCover(prisma, 'wrong', 'library'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.canonicalEpubResource.findFirst).not.toHaveBeenCalled();
  },
);
it('refuses missing validated provenance and never reads arbitrary blobs', async () => {
  const { prisma, mock } = coverFixture();
  mock.canonicalEpubImport.findFirst.mockResolvedValue(null);
  await expect(
    getImportedEpubCover(prisma, 'owner', 'library'),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(mock.canonicalEpubResource.findFirst).not.toHaveBeenCalled();
});
it('refuses corrupted bytes and deletion while loading', async () => {
  const a = coverFixture();
  a.blob.bytes[0] ^= 1;
  await expect(
    getImportedEpubCover(a.prisma, 'owner', 'library'),
  ).rejects.toBeInstanceOf(NotFoundException);
  const b = coverFixture();
  b.mock.libraryItem.findFirst
    .mockResolvedValueOnce({
      bookId: 'book',
      book: { canonicalImportPrivate: true, coverBlobId: 'cover' },
    })
    .mockResolvedValue(null);
  await expect(
    getImportedEpubCover(b.prisma, 'owner', 'library'),
  ).rejects.toBeInstanceOf(NotFoundException);
});

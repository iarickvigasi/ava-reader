import { readPdfMetadata } from './read-metadata';
import { editPdfMetadata } from './edit-metadata';
import { metadataFixture } from './test-fixture';

it('reads values and version under the owned item lock', async () => {
  const { prisma, tx } = metadataFixture();
  expect(await readPdfMetadata(prisma, 'owner', 'operation')).toMatchObject({
    operationId: 'operation',
    libraryItemId: 'library',
    title: 'Authored',
    metadataEditVersion: 0,
  });
  expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  expect(tx.pdfImportOperation.findFirst).toHaveBeenCalledTimes(2);
});
it('refuses another owner or deletion before returning a snapshot', async () => {
  const { prisma, tx } = metadataFixture();
  tx.pdfImportOperation.findFirst.mockResolvedValueOnce(null);
  await expect(readPdfMetadata(prisma, 'other', 'operation')).rejects.toThrow(
    'Import not found',
  );
  tx.pdfImportOperation.findFirst
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(null);
  await expect(readPdfMetadata(prisma, 'owner', 'operation')).rejects.toThrow(
    'Import not found',
  );
});
it('keeps a stale edit from overwriting current values', async () => {
  const { prisma, tx } = metadataFixture();
  tx.book.updateMany.mockResolvedValue({ count: 0 });
  await expect(
    editPdfMetadata(prisma, 'owner', 'operation', {
      title: 'Draft',
      expectedVersion: 0,
    }),
  ).rejects.toThrow('Book details changed');
});
it('returns the complete saved snapshot after conditional edit', async () => {
  const { prisma, tx, book } = metadataFixture();
  tx.book.findUniqueOrThrow.mockResolvedValueOnce(book).mockResolvedValueOnce({
    ...book,
    authors: ['Reader'],
    metadataEditVersion: 1,
  });
  expect(
    await editPdfMetadata(prisma, 'owner', 'operation', {
      authors: ['Reader'],
      expectedVersion: 0,
    }),
  ).toMatchObject({
    title: 'Authored',
    authors: ['Reader'],
    language: null,
    metadataEditVersion: 1,
  });
  expect(tx.book.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'book', metadataEditVersion: 0 },
      data: expect.objectContaining({
        metadataEditVersion: { increment: 1 },
        metadataUserFields: ['authors'],
      }) as unknown,
    }),
  );
});

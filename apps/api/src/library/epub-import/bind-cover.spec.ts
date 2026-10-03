import type { Prisma } from '@prisma/client';
import { fixture } from '../../reader/canonical/test-fixture';
import { bindImportedCover } from './bind-cover';
it('binds the declared cover to its validated resource hash, without importing a URL', async () => {
  const { book } = fixture();
  const cover = book.resources.find((r) => r.id === book.cover_resource_id)!;
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  await bindImportedCover(
    { book: { updateMany } } as unknown as Prisma.TransactionClient,
    'book',
    book,
    new Map([[cover.sha256, 'owned-blob']]),
  );
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 'book', canonicalImportPrivate: true },
    data: { coverBlobId: 'owned-blob' },
  });
  await expect(
    bindImportedCover(
      { book: { updateMany } } as unknown as Prisma.TransactionClient,
      'book',
      book,
      new Map(),
    ),
  ).rejects.toThrow('EPUB_COVER_BINDING_INVALID');
});
it('keeps absent covers absent', async () => {
  const { book } = fixture();
  book.cover_resource_id = null;
  const updateMany = jest.fn();
  await bindImportedCover(
    { book: { updateMany } } as unknown as Prisma.TransactionClient,
    'book',
    book,
    new Map(),
  );
  expect(updateMany).not.toHaveBeenCalled();
});

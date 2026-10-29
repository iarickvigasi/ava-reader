import { previewImport } from './preview-import';
import { loadImport } from './load-import';
import { addBookToUserLibraryTx } from '../../library/membership/add-book-to-user-library';
import { PUBLIC_CATALOG_BOOK } from '../../shared/private-book-access';
import type { PrismaService } from '../../prisma/prisma.service';
jest.mock('./load-import');
jest.mock('../../library/membership/add-book-to-user-library');
const findFirst = jest.fn();
const tx = { catalogEntry: { findFirst } };
const db = {
  $transaction: (action: (client: typeof tx) => Promise<unknown>) => action(tx),
} as unknown as PrismaService;
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(loadImport).mockResolvedValue({
    entry: { id: 'entry' },
    processed: true,
    source: { id: 'source' },
    output: { id: 'output' },
    receipt: { status: 'PROCESSED' },
  } as Awaited<ReturnType<typeof loadImport>>);
});
it('allows first admin acquisition only after verifying the exact processed public copy', async () => {
  findFirst.mockResolvedValue({ bookId: 'book' });
  await previewImport(db, 'admin', 'edition', 'checksum');
  expect(findFirst).toHaveBeenCalledWith({
    where: {
      id: 'entry',
      book: {
        visibility: 'PUBLIC',
        privateOwnerId: null,
        AND: [
          { files: { some: { id: 'source', isPrimary: true } } },
          {
            files: {
              some: {
                id: 'output',
                isPrimary: true,
                processingStatus: 'READY',
              },
            },
          },
        ],
      },
    },
    select: { bookId: true },
  });
  expect(addBookToUserLibraryTx).toHaveBeenCalledWith(
    tx,
    {
      bookId: 'book',
      originCatalogEntryId: 'entry',
      source: 'CATALOG',
      userId: 'admin',
    },
    PUBLIC_CATALOG_BOOK,
  );
});
it('never creates membership if the public copy no longer matches', async () => {
  findFirst.mockResolvedValue(null);
  await expect(
    previewImport(db, 'admin', 'edition', 'checksum'),
  ).rejects.toThrow('changed');
  expect(addBookToUserLibraryTx).not.toHaveBeenCalled();
});

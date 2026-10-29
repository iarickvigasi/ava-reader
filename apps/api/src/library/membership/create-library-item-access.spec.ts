import { createLibraryItemTx } from './create-library-item';
import {
  privateBookAccess,
  PUBLIC_CATALOG_BOOK,
} from '../../shared/private-book-access';
import type { Prisma } from '@prisma/client';
it('preserves ordinary ownership checks and allows an explicitly authorized public preview scope', async () => {
  const findUniqueOrThrow = jest
    .fn()
    .mockResolvedValue({ title: 'Dracula', authors: ['Bram Stoker'] });
  const tx = {
    book: { findUniqueOrThrow },
    libraryItem: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
  const input = {
    bookId: 'book',
    userId: 'reader',
    source: 'CATALOG' as const,
  };
  await createLibraryItemTx(tx, input);
  expect(findUniqueOrThrow).toHaveBeenLastCalledWith({
    where: { id: 'book', AND: privateBookAccess('reader') },
    select: { title: true, authors: true },
  });
  await createLibraryItemTx(tx, input, PUBLIC_CATALOG_BOOK);
  expect(findUniqueOrThrow).toHaveBeenLastCalledWith({
    where: { id: 'book', AND: { visibility: 'PUBLIC' } },
    select: { title: true, authors: true },
  });
});

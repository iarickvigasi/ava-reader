import { NotFoundException } from '@nestjs/common';
import { deleteLibraryItem } from './delete-library-item';

function fixture() {
  const tx = {
    $executeRaw: jest.fn(),
    libraryItem: {
      findFirst: jest.fn().mockResolvedValue({ id: 'book' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    deletedLibraryItem: { findFirst: jest.fn(), upsert: jest.fn() },
    readingSession: {
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    readingSessionSegment: { deleteMany: jest.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
        run(tx),
      ),
    },
  };
}

it('deletes the owned copy while retaining reading history and pending checkpoints', async () => {
  const { tx, prisma } = fixture();
  await expect(
    deleteLibraryItem(prisma as never, 'user', 'book'),
  ).resolves.toEqual({ libraryItemId: 'book', state: 'deleted' });
  expect(tx.libraryItem.findFirst).toHaveBeenCalledWith({
    where: { id: 'book', userId: 'user' },
    select: { id: true },
  });
  expect(tx.libraryItem.deleteMany).toHaveBeenCalledWith({
    where: { id: 'book', userId: 'user' },
  });
  expect(tx.deletedLibraryItem.upsert).toHaveBeenCalledWith({
    where: { id: 'book' },
    create: { id: 'book', userId: 'user' },
    update: {},
  });
  expect(tx.readingSession.update).not.toHaveBeenCalled();
  expect(tx.readingSession.deleteMany).not.toHaveBeenCalled();
  expect(tx.readingSessionSegment.deleteMany).not.toHaveBeenCalled();
});

it('rejects an unknown or foreign book without changing any data', async () => {
  const { tx, prisma } = fixture();
  tx.libraryItem.findFirst.mockResolvedValue(null);
  tx.deletedLibraryItem.findFirst.mockResolvedValue(null);
  await expect(
    deleteLibraryItem(prisma as never, 'user', 'foreign'),
  ).rejects.toBeInstanceOf(NotFoundException);
  expect(tx.libraryItem.deleteMany).not.toHaveBeenCalled();
  expect(tx.deletedLibraryItem.upsert).not.toHaveBeenCalled();
});

it('allows idempotent retries only for an owned deletion receipt', async () => {
  const { tx, prisma } = fixture();
  tx.libraryItem.findFirst.mockResolvedValue(null);
  tx.deletedLibraryItem.findFirst.mockResolvedValue({ id: 'book' });
  await expect(
    deleteLibraryItem(prisma as never, 'user', 'book'),
  ).resolves.toMatchObject({ state: 'deleted' });
  expect(tx.deletedLibraryItem.findFirst).toHaveBeenCalledWith({
    where: { id: 'book', userId: 'user' },
  });
  expect(tx.libraryItem.deleteMany).not.toHaveBeenCalled();
});

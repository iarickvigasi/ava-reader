import type { PrismaService } from '../../prisma/prisma.service';
import { membershipTestCollections } from './membership-test-collections';

export function membershipTestFixture() {
  const { records, members, collection } = membershipTestCollections();
  const collectionItem = {
    createMany: jest.fn(
      ({
        data,
      }: {
        data: { collectionId: string; libraryItemId: string }[];
      }) => {
        data.forEach(({ collectionId, libraryItemId }) =>
          members.get(collectionId)!.add(libraryItemId),
        );
        return Promise.resolve({ count: data.length });
      },
    ),
    deleteMany: jest.fn(
      ({
        where,
      }: {
        where: { libraryItemId: string; collectionId: { in: string[] } };
      }) => {
        where.collectionId.in.forEach((id) =>
          members.get(id)!.delete(where.libraryItemId),
        );
        return Promise.resolve({ count: where.collectionId.in.length });
      },
    ),
    findMany: jest.fn(
      ({
        where,
      }: {
        where: { libraryItemId: string; collection: { userId: string } };
      }) =>
        Promise.resolve(
          records
            .filter(
              (row) =>
                row.userId === where.collection.userId &&
                members.get(row.id)!.has(where.libraryItemId),
            )
            .map((row) => ({ collection: row })),
        ),
    ),
  };
  const libraryItem = {
    findFirst: jest.fn(
      ({
        where,
      }: {
        where: { id: string; userId: string; isArchived: boolean };
      }) =>
        Promise.resolve(
          where.id === 'book' && where.userId === 'user' && !where.isArchived
            ? { id: 'book' }
            : null,
        ),
    ),
  };
  const tx = { collection, collectionItem, libraryItem };
  const transaction = jest.fn((run: (value: typeof tx) => unknown) => run(tx));
  const prisma = { $transaction: transaction } as unknown as PrismaService;
  const options = {
    prisma,
    userId: 'user',
    libraryItemId: 'book',
    input: { addCollectionIds: ['added'], removeCollectionIds: ['removed'] },
  };
  return {
    options,
    collection,
    collectionItem,
    libraryItem,
    transaction,
    members,
  };
}

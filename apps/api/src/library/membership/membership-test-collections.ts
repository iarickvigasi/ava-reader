import type { CollectionKind } from '@prisma/client';
import { membershipTestBook } from './membership-test-book';

export function membershipTestCollections() {
  const records = ['added', 'removed', 'untouched', 'smart', 'foreign'].map(
    (id) => ({
      id,
      userId: id === 'foreign' ? 'another-user' : 'user',
      kind: (id === 'smart' ? 'SMART' : 'CUSTOM') as CollectionKind,
      name: id,
      slug: id,
      smartKey: id === 'smart' ? 'imported-library' : null,
      sortOrder: id === 'smart' ? 0 : 1,
      description: null,
    }),
  );
  const members = new Map(records.map(({ id }) => [id, new Set<string>()]));
  ['removed', 'untouched', 'smart'].forEach((id) =>
    members.get(id)!.add('book'),
  );
  for (let index = 0; index < 5; index += 1)
    members.get('added')!.add(`other-${index}`);
  const collection = {
    findMany: jest.fn(
      ({ where }: { where: { id: { in: string[] }; userId: string } }) =>
        Promise.resolve(
          records
            .filter(
              (row) =>
                where.id.in.includes(row.id) && row.userId === where.userId,
            )
            .map((row) => ({
              ...row,
              items: [...members.get(row.id)!].map((id) => ({
                libraryItem: membershipTestBook(id),
              })),
            })),
        ),
    ),
  };
  return { records, members, collection };
}

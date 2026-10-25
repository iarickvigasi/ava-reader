import { BookFileFormat, BookFileKind } from '@prisma/client';

export function overviewTestFixture() {
  const items = Array.from({ length: 7 }, (_, i) => ({
    id: `item-${i}`,
    isArchived: i === 6,
    finishedAt: null,
    addedAt: new Date(`2026-10-${10 + i}T00:00:00Z`),
    lastOpenedAt: null,
    progress: { completionPercent: 0, lastReadAt: null },
  }));
  const cards = items.map((item) => ({
    ...item,
    slug: item.id,
    offlineRequested: true,
    book: {
      id: item.id,
      title: item.id,
      authors: [],
      coverBlob: null,
      files: [
        {
          format: BookFileFormat.EPUB,
          kind: BookFileKind.SOURCE,
          isPrimary: true,
        },
      ],
    },
  }));
  const collections = [
    {
      id: 'custom',
      kind: 'CUSTOM',
      smartKey: null,
      name: 'Imported Books',
      description: null,
      slug: 'imported-books',
      sortOrder: 0,
      items: items.slice(0, 5).map((libraryItem) => ({ libraryItem })),
    },
  ];
  const findMany = jest.fn(({ where }: { where: { id?: { in: string[] } } }) =>
    Promise.resolve(
      where.id ? cards.filter((card) => where.id!.in.includes(card.id)) : items,
    ),
  );
  const prisma = {
    libraryItem: { findMany },
    collection: { findMany: jest.fn().mockResolvedValue(collections) },
  };
  return {
    prisma,
    items,
    cards,
    collections,
    options: { prisma: prisma as never, userId: 'owner' },
  };
}

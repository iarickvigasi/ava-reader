import { selectHomeCollections } from './collections-panel';

function item(addedAt: string, completionPercent = 0) {
  return {
    libraryItem: {
      addedAt: new Date(addedAt),
      id: addedAt,
      finishedAt: null as Date | null,
      lastOpenedAt: null,
      progress: { completionPercent, lastReadAt: null },
    },
  };
}

function collection(name: string, items: ReturnType<typeof item>[]) {
  return {
    description: null,
    id: name,
    items,
    kind: 'CUSTOM' as const,
    name,
    slug: name,
    smartKey: null,
  };
}

describe('selectHomeCollections', () => {
  it('lists the six most relevant shelves, not the first six given', () => {
    const shelves = Array.from({ length: 8 }, (_, index) =>
      collection(`Shelf ${index}`, [
        item(`2026-08-${10 + index}T00:00:00.000Z`),
      ]),
    );

    expect(selectHomeCollections(shelves).map((entry) => entry.name)).toEqual([
      'Shelf 7',
      'Shelf 6',
      'Shelf 5',
      'Shelf 4',
      'Shelf 3',
      'Shelf 2',
    ]);
  });

  it('keeps the library rule: recency, then fewest items, empty last', () => {
    const recent = item('2026-08-30T00:00:00.000Z');
    const older = item('2026-01-01T00:00:00.000Z');

    expect(
      selectHomeCollections([
        collection('Broad', [recent, older, older]),
        collection('Empty', []),
        collection('Narrow', [recent]),
      ]).map((entry) => entry.name),
    ).toEqual(['Narrow', 'Broad', 'Empty']);
  });

  it('serializes counts over every item on the shelf', () => {
    const [entry] = selectHomeCollections([
      collection('Mixed', [
        item('2026-08-01T00:00:00.000Z', 100),
        item('2026-08-02T00:00:00.000Z', 40),
      ]),
    ]);

    expect(entry).toMatchObject({ itemCount: 2, unreadCount: 1 });
  });

  it('returns snapshots matching counts when finish dates and 100% overlap', () => {
    const date = new Date('2026-09-14T10:00:00.000Z');
    const manual = item('2026-08-01T00:00:00.000Z', 20);
    manual.libraryItem.finishedAt = date;
    const both = item('2026-08-02T00:00:00.000Z', 100);
    both.libraryItem.finishedAt = date;
    const unread = item('2026-08-03T00:00:00.000Z', 99);
    const [entry] = selectHomeCollections([
      collection('Mixed', [manual, both, unread]),
    ]);

    expect(entry).toMatchObject({ itemCount: 3, unreadCount: 1 });
    expect(entry.completionItems).toEqual([
      {
        libraryItemId: manual.libraryItem.id,
        finishedAt: date.toISOString(),
        completionPercent: 20,
      },
      {
        libraryItemId: both.libraryItem.id,
        finishedAt: date.toISOString(),
        completionPercent: 100,
      },
      {
        libraryItemId: unread.libraryItem.id,
        finishedAt: null,
        completionPercent: 99,
      },
    ]);
  });
});

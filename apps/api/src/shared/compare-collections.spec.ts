import { compareCollectionsForDisplay } from './compare-collections';

function key(
  name: string,
  itemCount: number,
  lastEngagementAt: Date | null = new Date('2026-08-01T00:00:00.000Z'),
) {
  return { itemCount, lastEngagementAt, name };
}

function order(keys: ReturnType<typeof key>[]): string[] {
  return [...keys]
    .sort(compareCollectionsForDisplay)
    .map((collection) => collection.name);
}

describe('compareCollectionsForDisplay', () => {
  it('puts the most recently engaged collection first', () => {
    expect(
      order([
        key('Older', 3, new Date('2026-08-01T00:00:00.000Z')),
        key('Newer', 3, new Date('2026-08-30T00:00:00.000Z')),
      ]),
    ).toEqual(['Newer', 'Older']);
  });

  it('breaks a recency tie by fewest items, so the specific shelf leads', () => {
    const sameBook = new Date('2026-08-30T00:00:00.000Z');
    expect(
      order([
        key('Imported Books', 100, sameBook),
        key('Offline Books', 20, sameBook),
        key('Sci-fi', 5, sameBook),
      ]),
    ).toEqual(['Sci-fi', 'Offline Books', 'Imported Books']);
  });

  it('sinks empty collections below every engaged one, however stale', () => {
    expect(
      order([
        key('Empty', 0, null),
        key('Ancient', 40, new Date('2020-01-01T00:00:00.000Z')),
      ]),
    ).toEqual(['Ancient', 'Empty']);
  });

  it('orders collections tied on every other key by name', () => {
    const sameBook = new Date('2026-08-30T00:00:00.000Z');
    expect(
      order([key('Beta', 2, sameBook), key('Alpha', 2, sameBook)]),
    ).toEqual(['Alpha', 'Beta']);
    expect(order([key('Zeta', 0, null), key('Delta', 0, null)])).toEqual([
      'Delta',
      'Zeta',
    ]);
  });
});

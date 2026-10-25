import { getLibraryOverview } from './get-library-overview';
import { overviewTestFixture } from './overview-test-fixture';

describe('independent Library catalog', () => {
  it('lists every active book with no collections, retaining archived identities for pruning', async () => {
    const { options, prisma, items } = overviewTestFixture();
    prisma.collection.findMany.mockResolvedValue([]);
    const result = await getLibraryOverview(options);
    expect(result.books.map((book) => book.libraryItemId)).toEqual(
      items
        .slice(0, 6)
        .reverse()
        .map((item) => item.id),
    );
    expect(result.libraryItemIds).toContain('item-6');
    expect(result.summary).toEqual({ booksCount: 6, collectionsCount: 0 });
    expect(result.collections).toEqual([]);
  });

  it('counts books independently and keeps complete memberships beyond collection previews', async () => {
    const { options, prisma } = overviewTestFixture();
    const result = await getLibraryOverview(options);
    expect(result.summary).toEqual({ booksCount: 6, collectionsCount: 1 });
    expect(result.collections[0]).toMatchObject({
      name: 'Imported Books',
      itemCount: 5,
      unreadCount: 5,
    });
    expect(result.collections[0].books).toHaveLength(4);
    expect(result.collections[0].completionItems).toHaveLength(5);
    expect(result.books).toHaveLength(6);
    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner' } }),
    );
    expect(prisma.libraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner' } }),
    );
  });

  it('uses recent opens when sorting and does not read cover bytes', async () => {
    const { options, items, prisma } = overviewTestFixture();
    items[0].lastOpenedAt = new Date('2026-10-25T00:00:00Z') as never;
    const result = await getLibraryOverview(options);
    expect(result.books[0].libraryItemId).toBe('item-0');
    expect(
      JSON.stringify(prisma.libraryItem.findMany.mock.calls),
    ).not.toContain('"bytes"');
  });
});

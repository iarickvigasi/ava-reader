import { createHomeContractFixture } from './home-contract-fixture';
jest.mock('./load-catalog-covers', () => ({
  loadCatalogCovers: jest.fn().mockResolvedValue(new Map()),
}));

it.each([true, false])(
  'reports featured membership for the current user (%s)',
  async (owned) => {
    const { service, prisma, libraryItem } = createHomeContractFixture();
    prisma.catalogEntry.findMany.mockResolvedValue([
      { id: 'entry', book: libraryItem.book, isFeatured: true },
    ]);
    prisma.libraryItem.findMany.mockResolvedValue(
      owned ? [{ ...libraryItem, originCatalogEntryId: 'entry' }] : [],
    );
    const home = await service.getHome('clerk_1');
    expect(home.featuredCatalog.entries[0].libraryItemId).toBe(
      owned ? 'library-1' : null,
    );
  },
);

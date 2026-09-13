import { loadHomeCatalog } from './load-home-catalog';
import type { CatalogEntryRecord } from './types';

describe('loadHomeCatalog ranking', () => {
  it.each([
    ['featured status', { isFeatured: false, featuredRank: 0, sortOrder: -1 }],
    ['featured rank', { featuredRank: 2, sortOrder: -1 }],
    ['missing featured rank', { featuredRank: null, sortOrder: -1 }],
    ['sort order', { sortOrder: 2 }],
    ['update recency', { updatedAt: new Date('2026-09-01T00:00:00Z') }],
  ])('prioritizes %s before later criteria', async (_label, overrides) => {
    const findMany = jest.fn().mockResolvedValue([
      entry('runner-up', {
        updatedAt: new Date('2026-09-03T00:00:00Z'),
        ...overrides,
      }),
      entry('winner'),
      entry('excluded', { isFeatured: false, featuredRank: null }),
    ]);

    const entries = await loadHomeCatalog({
      catalogEntry: { findMany },
    } as never);

    expect(entries.map(({ id }) => id)).toEqual(['winner', 'runner-up']);
  });

  it('limits catalog reads to published books and lightweight cover/file data', async () => {
    const findMany = jest.fn().mockResolvedValue([]);

    await expect(
      loadHomeCatalog({ catalogEntry: { findMany } } as never),
    ).resolves.toEqual([]);

    expect(findMany).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      include: {
        book: {
          include: {
            coverBlob: { select: { mimeType: true } },
            files: { select: { format: true, isPrimary: true, kind: true } },
          },
        },
      },
    });
  });
});

function entry(id: string, overrides: Partial<CatalogEntryRecord> = {}) {
  return {
    id,
    isFeatured: true,
    featuredRank: 1,
    sortOrder: 1,
    updatedAt: new Date('2026-09-02T00:00:00Z'),
    book: { authors: [], coverBlob: null, files: [], title: id },
    ...overrides,
  };
}

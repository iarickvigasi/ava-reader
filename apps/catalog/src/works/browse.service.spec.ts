import { BrowseService } from './browse.service';
import type { CatalogDatabase } from '../database/catalog-database';
import { parseBrowseQuery } from './browse-query';

const ids = [1, 2, 3, 4, 5].map(
  (index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
);
const rows = ids.map((id) => ({ id }));
describe('bidirectional work pagination', () => {
  it('reads the previous page in reverse index order and returns ascending cards', async () => {
    const findMany = jest.fn().mockResolvedValue([rows[3], rows[2], rows[1]]);
    const service = new BrowseService({
      work: { findMany },
    } as unknown as CatalogDatabase);
    const result = await service.list(
      parseBrowseQuery({ before: ids[4], limit: '2' }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, AND: [{ id: { lt: ids[4] } }] },
        orderBy: { id: 'desc' },
        take: 3,
      }),
    );
    expect(result.items).toEqual([rows[2], rows[3]]);
    expect(result.previousCursor).toBe(ids[2]);
    expect(result.nextCursor).toBe(ids[3]);
  });
  it('stops reverse paging at the first matching book', async () => {
    const service = new BrowseService({
      work: { findMany: jest.fn().mockResolvedValue([rows[1], rows[0]]) },
    } as unknown as CatalogDatabase);
    const result = await service.list(
      parseBrowseQuery({ before: ids[2], limit: '2' }),
    );
    expect(result.previousCursor).toBeNull();
    expect(result.items).toEqual([rows[0], rows[1]]);
  });
});

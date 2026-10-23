import { NotFoundException } from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
import { WorksService } from './works.service';

const workId = '20000000-0000-4000-8000-000000000001';

describe('work reads', () => {
  const db = {
    work: { findUnique: jest.fn() },
    edition: { findMany: jest.fn() },
  };
  const service = new WorksService(db as unknown as CatalogDatabase);
  beforeEach(() => jest.resetAllMocks());

  it('returns 404 rather than an empty detail for a missing work', async () => {
    db.work.findUnique.mockResolvedValue(null);
    await expect(service.find(workId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.editions(workId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.edition.findMany).not.toHaveBeenCalled();
  });

  it('bounds edition pages and uses an exclusive ordered cursor', async () => {
    db.work.findUnique.mockResolvedValue({ id: workId });
    db.edition.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, id) => ({ id: `${id}` })),
    );
    const page = await service.editions(workId, workId);
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBe('19');
    expect(db.edition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 21,
        where: { workId, id: { gt: workId } },
        orderBy: { id: 'asc' },
      }),
    );
  });

  it('returns an empty page for a work with no editions', async () => {
    db.work.findUnique.mockResolvedValue({ id: workId });
    db.edition.findMany.mockResolvedValue([]);
    await expect(service.editions(workId)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });
});

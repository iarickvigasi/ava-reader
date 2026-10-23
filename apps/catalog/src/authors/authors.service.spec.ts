import { NotFoundException } from '@nestjs/common';
import { CatalogDatabase } from '../database/catalog-database';
import { AuthorsService } from './authors.service';

describe('author reads', () => {
  const db = {
    author: { findUnique: jest.fn() },
    work: { findMany: jest.fn() },
  };
  const service = new AuthorsService(db as unknown as CatalogDatabase);
  beforeEach(() => jest.resetAllMocks());

  it('returns 404 for an unknown author or works parent', async () => {
    db.author.findUnique.mockResolvedValue(null);
    await expect(service.find('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.works('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.work.findMany).not.toHaveBeenCalled();
  });

  it('finds distinct works rather than repeating each credit role', async () => {
    db.author.findUnique.mockResolvedValue({ id: 'author' });
    db.work.findMany.mockResolvedValue([
      { id: 'work', originalTitle: 'Example' },
    ]);
    await expect(service.works('author')).resolves.toMatchObject({
      nextCursor: null,
    });
    expect(db.work.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { credits: { some: { authorId: 'author' } } },
        take: 21,
      }),
    );
  });
});

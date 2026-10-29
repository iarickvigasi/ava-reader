import { LinkTargetController } from './link-target.controller';
import type { CatalogDatabase } from '../database/catalog-database';
it('returns a public work description without an exact edition', async () => {
  const db = {
    work: {
      findUnique: jest.fn().mockResolvedValue({
        revision: 1,
        originalTitle: 'Classic',
        credits: [],
      }),
    },
    edition: { findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as CatalogDatabase;
  await expect(new LinkTargetController(db).target('work')).resolves.toEqual({
    workId: 'work',
    revision: 1,
    title: 'Classic',
    authors: [],
  });
});

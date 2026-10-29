import { EditionsController } from './editions.controller';
import type { CatalogDatabase } from '../database/catalog-database';
it('returns edition details and public work context without source mappings', async () => {
  const edition = {
    id: 'edition',
    work: { id: 'work', originalTitle: 'Dracula' },
  };
  const findUnique = jest.fn().mockResolvedValue(edition);
  const db = { edition: { findUnique } } as unknown as CatalogDatabase;
  await expect(new EditionsController(db).find('edition')).resolves.toEqual(
    edition,
  );
  const [query] = findUnique.mock.calls[0] as [
    { where: object; include: object; omit: object },
  ];
  expect(query.omit).toEqual({ metadataOverrides: true });
  expect(query.where).toEqual({ id: 'edition', work: { deletedAt: null } });
  expect(query.include).not.toHaveProperty('sourceMappings');
  expect(query.include).toMatchObject({
    importEvidence: {
      take: 20,
      select: {
        checksum: true,
        provider: true,
        sourceUrl: true,
        downloadUrl: true,
        filename: true,
      },
    },
    readingAssets: {
      where: { status: 'READY', mainCatalogEntryId: { not: null } },
      take: 20,
    },
  });
});
it('hides missing editions and editions of deleted works', async () => {
  const db = {
    edition: { findUnique: jest.fn().mockResolvedValue(null) },
  } as unknown as CatalogDatabase;
  await expect(new EditionsController(db).find('edition')).rejects.toThrow(
    'Edition not found',
  );
});

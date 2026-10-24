import type { CatalogDatabase } from '../src/database/catalog-database';

export async function createReadingFixtures(
  db: CatalogDatabase,
  workId: string,
) {
  const editions = await db.edition.findMany({ where: { workId } });
  for (const edition of editions) {
    await db.readingAsset.create({
      data: {
        editionId: edition.id,
        checksum: `fixture-${edition.id}`,
        mediaType: 'application/epub+zip',
        sourceUrl: 'https://example.org/test.epub',
        rightsStatement: 'Test fixture only',
        rightsUrl: 'https://example.org/rights',
        rightsJurisdiction: 'US',
        reviewedAt: new Date(),
        status: edition.language === 'ru' ? 'READY' : 'PENDING',
        mainCatalogEntryId: 'test-only-entry',
      },
    });
  }
}

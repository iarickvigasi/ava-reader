import type { CatalogDatabase } from '../../database/catalog-database';

export function loadPublicBlob(db: CatalogDatabase, id: string) {
  return db.$transaction(
    async (tx) => {
      // A reader package can exceed the short browse-query budget. SET LOCAL cannot leak to the pool.
      await tx.$executeRaw`SET LOCAL statement_timeout = '45s'`;
      return tx.publicBlob.findUniqueOrThrow({ where: { id } });
    },
    { timeout: 50_000 },
  );
}
